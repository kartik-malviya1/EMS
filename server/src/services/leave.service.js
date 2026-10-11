import { DateTime } from 'luxon';
import { LeaveRequest } from '../models/leave.model.js';
import { User } from '../models/user.model.js';
import { Attendance } from '../models/attendance.model.js';
import {
  ROLES,
  LEAVE_STATUS,
  DEFAULT_WORKING_DAYS,
  DEFAULT_BUSINESS_TIMEZONE,
  ACCOUNT_STATUS,
  AUDIT_ACTIONS,
} from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { logAuditEvent } from './audit.service.js';
import {
  notifyLeaveRequested,
  notifyLeaveReviewed,
} from './notification.service.js';

/**
 * Calculates working days in date range excluding non-working days.
 */
export const calculateLeaveWorkingDays = (startDate, endDate, isHalfDay = false) => {
  if (isHalfDay) {
    const dt = DateTime.fromISO(startDate, { zone: DEFAULT_BUSINESS_TIMEZONE });
    if (!dt.isValid) {
      throw new ApiError(400, 'INVALID_DATE', 'Invalid start date format');
    }
    if (!DEFAULT_WORKING_DAYS.includes(dt.weekday)) {
      throw new ApiError(
        400,
        'NO_WORKING_DAYS',
        'Half-day leave cannot be applied on a non-working day (weekend)'
      );
    }
    return 0.5;
  }

  const start = DateTime.fromISO(startDate, { zone: DEFAULT_BUSINESS_TIMEZONE }).startOf('day');
  const end = DateTime.fromISO(endDate, { zone: DEFAULT_BUSINESS_TIMEZONE }).startOf('day');

  if (!start.isValid || !end.isValid) {
    throw new ApiError(400, 'INVALID_DATE', 'Invalid date range');
  }

  if (start > end) {
    throw new ApiError(400, 'INVALID_DATE_RANGE', 'Start date cannot be after end date');
  }

  let count = 0;
  let curr = start;
  while (curr <= end) {
    if (DEFAULT_WORKING_DAYS.includes(curr.weekday)) {
      count++;
    }
    curr = curr.plus({ days: 1 });
  }

  if (count === 0) {
    throw new ApiError(
      400,
      'NO_WORKING_DAYS',
      'Selected date range contains no working days'
    );
  }

  return count;
};

/**
 * Apply for leave
 */
export const applyLeave = async ({ user, data, req }) => {
  if (user.accountStatus !== ACCOUNT_STATUS.ACTIVE) {
    throw new ApiError(403, 'ACCOUNT_INACTIVE', 'Account is not active');
  }

  if (user.role === ROLES.ADMIN) {
    throw new ApiError(
      403,
      'ADMIN_NOT_ELIGIBLE',
      'Administrators do not submit workforce leave requests'
    );
  }

  const daysCount = calculateLeaveWorkingDays(
    data.startDate,
    data.endDate,
    data.isHalfDay
  );

  // Check overlapping pending or approved leave requests
  const overlap = await LeaveRequest.findOne({
    userId: user._id,
    status: { $in: [LEAVE_STATUS.PENDING, LEAVE_STATUS.APPROVED] },
    startDate: { $lte: data.endDate },
    endDate: { $gte: data.startDate },
  });

  if (overlap) {
    throw new ApiError(
      409,
      'OVERLAPPING_LEAVE',
      'A pending or approved leave request already exists covering this date range'
    );
  }

  const leave = await LeaveRequest.create({
    userId: user._id,
    leaveType: data.leaveType,
    startDate: data.startDate,
    endDate: data.endDate,
    isHalfDay: Boolean(data.isHalfDay),
    halfDayPeriod: data.isHalfDay ? data.halfDayPeriod : null,
    daysCount,
    reason: data.reason,
  });

  // Notify manager or admin
  await notifyLeaveRequested({ leaveRequest: leave, employee: user });

  // Audit log
  await logAuditEvent({
    actor: user,
    action: AUDIT_ACTIONS.LEAVE_APPLIED,
    targetUser: user,
    metadata: {
      leaveId: leave._id,
      leaveType: leave.leaveType,
      startDate: leave.startDate,
      endDate: leave.endDate,
      daysCount: leave.daysCount,
    },
    req,
  });

  return leave;
};

/**
 * Get own leave requests (Employee / Manager)
 */
export const getMyLeaveRequests = async (userId, query = {}) => {
  const { status, leaveType, from, to, page = 1, limit = 20 } = query;
  const filter = { userId };

  if (status) filter.status = status;
  if (leaveType) filter.leaveType = leaveType;
  if (from) filter.startDate = { ...filter.startDate, $gte: from };
  if (to) filter.endDate = { ...filter.endDate, $lte: to };

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    LeaveRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('reviewedBy', 'name email role'),
    LeaveRequest.countDocuments(filter),
  ]);

  return {
    data,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get team leave requests (Manager only)
 */
export const getTeamLeaveRequests = async (managerUser, query = {}) => {
  const { status, leaveType, from, to, userId, page = 1, limit = 20 } = query;

  // Find all active team members reporting to this manager
  const teamMembers = await User.find({
    managerId: managerUser._id,
  }).select('_id');

  const teamMemberIds = teamMembers
    .map((m) => m._id)
    .filter((id) => !id.equals(managerUser._id)); // strictly exclude manager themself

  const filter = { userId: { $in: teamMemberIds } };

  if (userId) {
    // If specific employee filter requested, verify they are in team
    const isMember = teamMemberIds.some((id) => id.toString() === userId);
    if (!isMember) {
      throw new ApiError(403, 'OUT_OF_SCOPE', 'Employee is not in your assigned team');
    }
    filter.userId = userId;
  }

  if (status) filter.status = status;
  if (leaveType) filter.leaveType = leaveType;
  if (from) filter.startDate = { ...filter.startDate, $gte: from };
  if (to) filter.endDate = { ...filter.endDate, $lte: to };

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    LeaveRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email employeeId department designation')
      .populate('reviewedBy', 'name email role'),
    LeaveRequest.countDocuments(filter),
  ]);

  return {
    data,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get all leave requests system-wide (Admin only)
 */
export const getAllLeaveRequests = async (query = {}) => {
  const { status, leaveType, from, to, userId, page = 1, limit = 20 } = query;
  const filter = {};

  if (userId) filter.userId = userId;
  if (status) filter.status = status;
  if (leaveType) filter.leaveType = leaveType;
  if (from) filter.startDate = { ...filter.startDate, $gte: from };
  if (to) filter.endDate = { ...filter.endDate, $lte: to };

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    LeaveRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email employeeId department designation role')
      .populate('reviewedBy', 'name email role'),
    LeaveRequest.countDocuments(filter),
  ]);

  return {
    data,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get single leave request by ID with role scope check
 */
export const getLeaveRequestById = async (leaveId, requestingUser) => {
  const leave = await LeaveRequest.findById(leaveId)
    .populate('userId', 'name email employeeId department designation role managerId')
    .populate('reviewedBy', 'name email role');

  if (!leave) {
    throw new ApiError(404, 'NOT_FOUND', 'Leave request not found');
  }

  // Scope check
  if (requestingUser.role === ROLES.EMPLOYEE) {
    if (leave.userId._id.toString() !== requestingUser._id.toString()) {
      throw new ApiError(404, 'NOT_FOUND', 'Leave request not found');
    }
  } else if (requestingUser.role === ROLES.MANAGER) {
    const isOwner = leave.userId._id.toString() === requestingUser._id.toString();
    const isTeamMember =
      leave.userId.managerId &&
      leave.userId.managerId.toString() === requestingUser._id.toString();
    if (!isOwner && !isTeamMember) {
      throw new ApiError(404, 'NOT_FOUND', 'Leave request not found');
    }
  }

  return leave;
};

/**
 * Cancel a pending leave request
 */
export const cancelLeaveRequest = async ({ leaveId, user, req }) => {
  const leave = await LeaveRequest.findById(leaveId);
  if (!leave) {
    throw new ApiError(404, 'NOT_FOUND', 'Leave request not found');
  }

  const isOwner = leave.userId.toString() === user._id.toString();
  const isAdmin = user.role === ROLES.ADMIN;

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, 'FORBIDDEN', 'You can only cancel your own leave requests');
  }

  if (leave.status !== LEAVE_STATUS.PENDING) {
    throw new ApiError(
      409,
      'INVALID_TRANSITION',
      `Cannot cancel leave request that is already ${leave.status}`
    );
  }

  const updated = await LeaveRequest.findOneAndUpdate(
    {
      _id: leaveId,
      status: LEAVE_STATUS.PENDING,
    },
    {
      $set: { status: LEAVE_STATUS.CANCELLED },
    },
    { returnDocument: 'after' }
  );

  if (!updated) {
    throw new ApiError(409, 'INVALID_TRANSITION', 'Leave request status has changed concurrently');
  }

  await logAuditEvent({
    actor: user,
    action: AUDIT_ACTIONS.LEAVE_CANCELLED,
    targetUser: { _id: leave.userId },
    metadata: { leaveId: leave._id },
    req,
  });

  return updated;
};

/**
 * Review leave request (Approve / Reject)
 */
export const reviewLeaveRequest = async ({ leaveId, reviewerUser, action, remarks, req }) => {
  const leave = await LeaveRequest.findById(leaveId).populate(
    'userId',
    'name email role managerId'
  );

  if (!leave) {
    throw new ApiError(404, 'NOT_FOUND', 'Leave request not found');
  }

  const requesterId = leave.userId._id.toString();
  const reviewerId = reviewerUser._id.toString();

  // Self-review restriction: Managers cannot review own leave requests
  if (requesterId === reviewerId) {
    throw new ApiError(
      403,
      'CANNOT_SELF_REVIEW',
      'Managers cannot review their own leave requests'
    );
  }

  // Authorization check
  if (reviewerUser.role === ROLES.MANAGER) {
    const isAssignedManager =
      leave.userId.managerId &&
      leave.userId.managerId.toString() === reviewerId;

    if (!isAssignedManager) {
      throw new ApiError(
        403,
        'OUT_OF_SCOPE',
        'You can only review leave requests for your assigned team members'
      );
    }
  }

  if (leave.status !== LEAVE_STATUS.PENDING) {
    throw new ApiError(
      409,
      'INVALID_TRANSITION',
      `Leave request is already ${leave.status}`
    );
  }

  const targetStatus =
    action === 'approve' ? LEAVE_STATUS.APPROVED : LEAVE_STATUS.REJECTED;

  // Atomic transition
  const updated = await LeaveRequest.findOneAndUpdate(
    {
      _id: leaveId,
      status: LEAVE_STATUS.PENDING,
    },
    {
      $set: {
        status: targetStatus,
        reviewedBy: reviewerUser._id,
        reviewedAt: new Date(),
        reviewerRemarks: remarks || '',
      },
    },
    { returnDocument: 'after' }
  ).populate('userId', 'name email role');

  if (!updated) {
    throw new ApiError(409, 'INVALID_TRANSITION', 'Leave request was concurrently updated');
  }

  // If approved: preserve actual attendance records and flag any conflicting shifts for audit review
  if (targetStatus === LEAVE_STATUS.APPROVED) {
    await Attendance.updateMany(
      {
        employeeId: leave.userId._id,
        workDate: { $gte: leave.startDate, $lte: leave.endDate },
      },
      {
        $set: {
          'verification.remarks': 'Shift during approved leave: preserved for administrative review',
        },
      }
    );
  }

  // Deliver real-time notification to employee
  await notifyLeaveReviewed({
    leaveRequest: updated,
    reviewer: reviewerUser,
    status: targetStatus,
  });

  // Audit log
  await logAuditEvent({
    actor: reviewerUser,
    action:
      targetStatus === LEAVE_STATUS.APPROVED
        ? AUDIT_ACTIONS.LEAVE_APPROVED
        : AUDIT_ACTIONS.LEAVE_REJECTED,
    targetUser: leave.userId,
    metadata: {
      leaveId: leave._id,
      action,
      remarks,
      leaveType: leave.leaveType,
      startDate: leave.startDate,
      endDate: leave.endDate,
    },
    req,
  });

  return updated;
};

export default {
  calculateLeaveWorkingDays,
  applyLeave,
  getMyLeaveRequests,
  getTeamLeaveRequests,
  getAllLeaveRequests,
  getLeaveRequestById,
  cancelLeaveRequest,
  reviewLeaveRequest,
};
