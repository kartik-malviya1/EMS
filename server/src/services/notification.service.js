import { Notification } from '../models/notification.model.js';
import { User } from '../models/user.model.js';
import { ROLES, NOTIFICATION_TYPES } from '../config/constants.js';
import {
  emitNotification,
  emitAttendanceUpdated,
} from '../realtime/socket.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

/**
 * 1. Verification set valid/invalid -> notify the employee
 */
export const notifyVerificationReviewed = async ({ attendance, reviewer: _reviewer, status }) => {
  const employeeId = attendance.employeeId?._id || attendance.employeeId;
  const type =
    status === 'valid'
      ? NOTIFICATION_TYPES.ATTENDANCE_VALID
      : NOTIFICATION_TYPES.ATTENDANCE_INVALID;

  const title =
    status === 'valid' ? 'Attendance Verified' : 'Attendance Marked Invalid';
  const message =
    status === 'valid'
      ? `Your attendance for ${attendance.workDate} was marked valid.`
      : `Your attendance for ${attendance.workDate} was marked invalid: ${
          attendance.verification?.remarks || 'No remarks provided'
        }`;

  const doc = await Notification.create({
    userId: employeeId,
    type,
    title,
    message,
    data: { attendanceId: attendance._id },
  });

  emitNotification(employeeId, doc);
  emitAttendanceUpdated(
    attendance._id,
    employeeId,
    attendance.employeeId?.managerId || null
  );

  return doc;
};

/**
 * 2. Overtime requested -> notify the employee's manager + all admins
 * (admins only if the requester is a manager/admin; never the requester)
 */
export const notifyOvertimeRequested = async ({
  attendance,
  employee,
  requestedMinutes,
  reason: _reason,
}) => {
  const requesterId = (employee._id || employee).toString();
  const requesterRole = employee.role;
  const recipients = new Set();

  if (requesterRole === ROLES.EMPLOYEE) {
    // Notify manager if assigned
    const managerId = employee.managerId?._id || employee.managerId;
    if (managerId && managerId.toString() !== requesterId) {
      recipients.add(managerId.toString());
    }
  } else {
    // Requester is a manager or admin -> notify all admins (except requester)
    const admins = await User.find({ role: ROLES.ADMIN, isActive: true }).select('_id');
    for (const adm of admins) {
      if (adm._id.toString() !== requesterId) {
        recipients.add(adm._id.toString());
      }
    }
  }

  const title = 'Overtime Requested';
  const message = `${employee.name || 'An employee'} requested ${requestedMinutes} minutes of overtime for ${
    attendance.workDate
  }.`;

  const createdDocs = [];
  for (const recipientId of recipients) {
    const doc = await Notification.create({
      userId: recipientId,
      type: NOTIFICATION_TYPES.OVERTIME_REQUESTED,
      title,
      message,
      data: { attendanceId: attendance._id },
    });
    emitNotification(recipientId, doc);
    createdDocs.push(doc);
  }

  emitAttendanceUpdated(
    attendance._id,
    employee._id,
    employee.managerId || null
  );

  return createdDocs;
};

/**
 * 3. Overtime approved/rejected -> notify the employee
 */
export const notifyOvertimeReviewed = async ({ attendance, reviewer: _reviewer, decision }) => {
  const employeeId = attendance.employeeId?._id || attendance.employeeId;
  const type =
    decision === 'approved'
      ? NOTIFICATION_TYPES.OVERTIME_APPROVED
      : NOTIFICATION_TYPES.OVERTIME_REJECTED;

  const title =
    decision === 'approved' ? 'Overtime Approved' : 'Overtime Rejected';
  const message =
    decision === 'approved'
      ? `Your overtime request for ${attendance.workDate} (${attendance.overtime?.requestedMinutes} mins) was approved.`
      : `Your overtime request for ${attendance.workDate} was rejected: ${
          attendance.overtime?.remarks || 'No remarks provided'
        }`;

  const doc = await Notification.create({
    userId: employeeId,
    type,
    title,
    message,
    data: { attendanceId: attendance._id },
  });

  emitNotification(employeeId, doc);
  emitAttendanceUpdated(
    attendance._id,
    employeeId,
    attendance.employeeId?.managerId || null
  );

  return doc;
};

/**
 * 4. Missed punch-in alert -> notify employee (idempotent per user & workDate)
 */
export const notifyMissedPunchIn = async ({ user, workDate }) => {
  const userId = user._id || user;

  // Idempotency: check if already notified
  const existing = await Notification.findOne({
    userId,
    type: NOTIFICATION_TYPES.MISSED_PUNCH_IN,
    'data.workDate': workDate,
  });

  if (existing) {
    return existing;
  }

  const doc = await Notification.create({
    userId,
    type: NOTIFICATION_TYPES.MISSED_PUNCH_IN,
    title: 'Missed Punch-In Alert',
    message: `You have not punched in today (${workDate}). Please punch in as soon as you arrive.`,
    data: { workDate },
  });

  emitNotification(userId, doc);
  return doc;
};

/**
 * 5. Missed punch-out alert -> notify employee (idempotent per attendance record)
 */
export const notifyMissedPunchOut = async ({ user, attendance }) => {
  const userId = user._id || user;

  // Idempotency check
  const existing = await Notification.findOne({
    userId,
    type: NOTIFICATION_TYPES.MISSED_PUNCH_OUT,
    'data.attendanceId': attendance._id,
  });

  if (existing) {
    return existing;
  }

  const doc = await Notification.create({
    userId,
    type: NOTIFICATION_TYPES.MISSED_PUNCH_OUT,
    title: 'Missed Punch-Out Alert',
    message: `You still have an open shift for ${attendance.workDate}. Don't forget to punch out.`,
    data: { attendanceId: attendance._id, workDate: attendance.workDate },
  });

  emitNotification(userId, doc);
  return doc;
};

/**
 * 6. Auto-close -> notify employee + their manager (idempotent per attendance record)
 */
export const notifyAutoClose = async ({ attendance }) => {
  const employeeId = attendance.employeeId?._id || attendance.employeeId;

  const recipients = new Set([employeeId.toString()]);

  // Find manager if populated or lookup
  let managerId = attendance.employeeId?.managerId;
  if (!managerId) {
    const empUser = await User.findById(employeeId).select('managerId');
    managerId = empUser?.managerId;
  }
  if (managerId) {
    recipients.add(managerId.toString());
  }

  const title = 'Attendance Auto-Closed';
  const message = `Shift for ${attendance.workDate} was automatically closed as missed due to missing punch out.`;

  const createdDocs = [];
  for (const recipientId of recipients) {
    const existing = await Notification.findOne({
      userId: recipientId,
      type: NOTIFICATION_TYPES.ATTENDANCE_AUTO_CLOSED,
      'data.attendanceId': attendance._id,
    });

    if (existing) {
      createdDocs.push(existing);
      continue;
    }

    const doc = await Notification.create({
      userId: recipientId,
      type: NOTIFICATION_TYPES.ATTENDANCE_AUTO_CLOSED,
      title,
      message,
      data: { attendanceId: attendance._id, workDate: attendance.workDate },
    });
    emitNotification(recipientId, doc);
    createdDocs.push(doc);
  }

  emitAttendanceUpdated(
    attendance._id,
    employeeId,
    managerId || null
  );

  return createdDocs;
};

/**
 * List paginated notifications for current user
 */
export const listUserNotifications = async (userId, query) => {
  const { unreadOnly = false, page = 1, limit = 20 } = query;

  const filter = { userId };
  if (unreadOnly === true || unreadOnly === 'true') {
    filter.readAt = null;
  }

  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(filter),
  ]);

  return {
    notifications,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get unread notification count
 */
export const getUnreadNotificationCount = async (userId) => {
  const unreadCount = await Notification.countDocuments({
    userId,
    readAt: null,
  });
  return { unreadCount };
};

/**
 * Mark a single notification as read (must belong to caller)
 */
export const markNotificationAsRead = async (userId, notificationId) => {
  const notification = await Notification.findOne({
    _id: notificationId,
    userId,
  });

  if (!notification) {
    throw new ApiError(404, 'NOT_FOUND', 'Notification not found');
  }

  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }

  return notification;
};

/**
 * Mark all unread notifications as read for current user
 */
export const markAllNotificationsAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { userId, readAt: null },
    { $set: { readAt: new Date() } }
  );

  logger.info(`Marked ${result.modifiedCount} notifications as read for user ${userId}`);
  return { modifiedCount: result.modifiedCount };
};

export default {
  notifyVerificationReviewed,
  notifyOvertimeRequested,
  notifyOvertimeReviewed,
  notifyMissedPunchIn,
  notifyMissedPunchOut,
  notifyAutoClose,
  listUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
