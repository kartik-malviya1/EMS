import { Attendance } from '../models/attendance.model.js';
import { User } from '../models/user.model.js';
import {
  WORKING_STATUS,
  CLOSED_BY,
  STANDARD_SHIFT_MINUTES,
  ROLES,
  VERIFICATION_STATUS,
  OVERTIME_STATUS,
} from '../config/constants.js';
import { getWorkDate, calculateWorkedMinutes } from '../utils/time.js';
import { getGeofenceSettings } from './settings.service.js';
import { evaluateGeofence } from './geofence.service.js';
import { uploadSelfie, getSelfie, deleteSelfie } from './storage.service.js';
import { buildScopeFilter, canAccessEmployee, canReview } from './scope.service.js';
import {
  notifyVerificationReviewed,
  notifyOvertimeRequested,
  notifyOvertimeReviewed,
} from './notification.service.js';
import { emitAttendanceUpdated } from '../realtime/socket.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

/**
 * Pure function: calculates workingStatus from workedMinutes.
 * >= 480 -> completed; < 480 -> incomplete
 */
export const calculateWorkingStatus = (workedMinutes) => {
  if (workedMinutes === null || workedMinutes === undefined) {
    return WORKING_STATUS.IN_PROGRESS;
  }
  return workedMinutes >= STANDARD_SHIFT_MINUTES
    ? WORKING_STATUS.COMPLETED
    : WORKING_STATUS.INCOMPLETE;
};

/**
 * Lazy auto-closes open records from previous days
 */
export const lazyAutoClose = async (employeeId, currentWorkDate) => {
  try {
    const result = await Attendance.updateMany(
      {
        employeeId,
        workingStatus: WORKING_STATUS.IN_PROGRESS,
        workDate: { $lt: currentWorkDate },
      },
      {
        $set: {
          workingStatus: WORKING_STATUS.MISSED,
          workedMinutes: 0,
          punchOut: null,
          closedBy: CLOSED_BY.SYSTEM,
        },
      }
    );
    if (result.modifiedCount > 0) {
      logger.info(
        `Lazy auto-closed ${result.modifiedCount} open records for employee ${employeeId}`
      );
    }
  } catch (err) {
    logger.error('Error during lazyAutoClose:', err.message);
  }
};

/**
 * Auto-closes any in_progress attendance records older than today.
 */
export const autoCloseOldRecords = async (todayWorkDate = getWorkDate()) => {
  const result = await Attendance.updateMany(
    {
      workingStatus: WORKING_STATUS.IN_PROGRESS,
      workDate: { $lt: todayWorkDate },
    },
    {
      $set: {
        workingStatus: WORKING_STATUS.MISSED,
        workedMinutes: 0,
        punchOut: null,
        closedBy: CLOSED_BY.SYSTEM,
      },
    }
  );
  return result;
};

/**
 * Punch-In
 */
export const punchIn = async ({ user, file, latitude, longitude, accuracy }) => {
  const now = new Date();
  const todayWorkDate = getWorkDate(now);

  // 1. Lazy auto-close any older open records first
  await lazyAutoClose(user._id, todayWorkDate);

  // 2. Pre-check if today's record already exists
  const existingToday = await Attendance.findOne({
    employeeId: user._id,
    workDate: todayWorkDate,
  });
  if (existingToday) {
    throw new ApiError(409, 'ALREADY_PUNCHED_IN', 'Already punched in for today');
  }

  // 3. Geofence evaluation
  const settings = await getGeofenceSettings();
  const geofenceResult = evaluateGeofence({
    latitude,
    longitude,
    accuracy,
    settings,
  });

  // 4. Upload selfie
  let uploadResult;
  try {
    uploadResult = await uploadSelfie({
      buffer: file.buffer,
      mimeType: file.verifiedMimeType || file.mimetype,
      employeeId: user._id.toString(),
      workDate: todayWorkDate,
      kind: 'punch-in',
    });
  } catch (uploadErr) {
    throw new ApiError(500, 'STORAGE_ERROR', 'Failed to store selfie', [uploadErr.message]);
  }

  // 5. Create attendance record
  try {
    const record = await Attendance.create({
      employeeId: user._id,
      workDate: todayWorkDate,
      punchIn: {
        at: now,
        selfie: {
          publicId: uploadResult.publicId,
          mimeType: uploadResult.mimeType,
          bytes: uploadResult.bytes,
        },
        location: {
          latitude,
          longitude,
          accuracy,
          distanceFromOfficeMeters: geofenceResult.distanceFromOfficeMeters,
          withinGeofence: geofenceResult.withinGeofence,
        },
      },
      punchOut: null,
      workedMinutes: null,
      workingStatus: WORKING_STATUS.IN_PROGRESS,
      closedBy: null,
    });

    emitAttendanceUpdated(record._id, user._id, user.managerId || null);

    return record;
  } catch (dbErr) {
    // Best-effort cleanup of uploaded selfie if DB write fails
    if (uploadResult?.publicId) {
      await deleteSelfie(uploadResult.publicId);
    }

    if (
      dbErr.code === 11000 ||
      dbErr.errorResponse?.code === 11000 ||
      dbErr.message?.includes('E11000')
    ) {
      throw new ApiError(409, 'ALREADY_PUNCHED_IN', 'Already punched in for today');
    }
    throw dbErr;
  }
};

/**
 * Punch-Out
 */
export const punchOut = async ({ user, file, latitude, longitude, accuracy }) => {
  const now = new Date();

  // 1. Locate the currently open attendance record
  const openRecord = await Attendance.findOne({
    employeeId: user._id,
    workingStatus: WORKING_STATUS.IN_PROGRESS,
  });

  if (!openRecord) {
    throw new ApiError(409, 'NO_OPEN_ATTENDANCE', 'No open attendance record found to punch out');
  }

  // 2. Reject if punchOut <= punchIn
  if (now.getTime() <= new Date(openRecord.punchIn.at).getTime()) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Punch out time cannot be earlier than or equal to punch in time'
    );
  }

  // 3. Geofence evaluation
  const settings = await getGeofenceSettings();
  const geofenceResult = evaluateGeofence({
    latitude,
    longitude,
    accuracy,
    settings,
  });

  // 4. Upload selfie
  let uploadResult;
  try {
    uploadResult = await uploadSelfie({
      buffer: file.buffer,
      mimeType: file.verifiedMimeType || file.mimetype,
      employeeId: user._id.toString(),
      workDate: openRecord.workDate,
      kind: 'punch-out',
    });
  } catch (uploadErr) {
    throw new ApiError(500, 'STORAGE_ERROR', 'Failed to store punch out selfie', [uploadErr.message]);
  }

  // 5. Calculate worked minutes & status
  const workedMinutes = calculateWorkedMinutes(openRecord.punchIn.at, now);
  const workingStatus = calculateWorkingStatus(workedMinutes);

  // 6. Atomic findOneAndUpdate
  const updated = await Attendance.findOneAndUpdate(
    {
      _id: openRecord._id,
      workingStatus: WORKING_STATUS.IN_PROGRESS, // Guarantees only 1 concurrent call succeeds
    },
    {
      $set: {
        punchOut: {
          at: now,
          selfie: {
            publicId: uploadResult.publicId,
            mimeType: uploadResult.mimeType,
            bytes: uploadResult.bytes,
          },
          location: {
            latitude,
            longitude,
            accuracy,
            distanceFromOfficeMeters: geofenceResult.distanceFromOfficeMeters,
            withinGeofence: geofenceResult.withinGeofence,
          },
        },
        workedMinutes,
        workingStatus,
        closedBy: CLOSED_BY.EMPLOYEE,
      },
    },
    { returnDocument: 'after' }
  );

  if (!updated) {
    // Concurrent request closed it in the meantime
    if (uploadResult?.publicId) {
      await deleteSelfie(uploadResult.publicId);
    }
    throw new ApiError(409, 'NO_OPEN_ATTENDANCE', 'No open attendance record found to punch out');
  }

  emitAttendanceUpdated(updated._id, user._id, user.managerId || null);

  return updated;
};

/**
 * Today's attendance for the user
 */
export const getTodayAttendance = async (userId) => {
  const todayWorkDate = getWorkDate();
  const record = await Attendance.findOne({
    employeeId: userId,
    workDate: todayWorkDate,
  });
  return record; // null if not yet punched in
};

/**
 * List attendance scoped by role and filters
 */
export const listAttendance = async (user, query) => {
  const {
    from,
    to,
    userId,
    workingStatus,
    verificationStatus,
    overtimeStatus,
    role,
    page = 1,
    limit = 20,
  } = query;

  // Base scope filter (admin: {}, manager: { employeeId: { $in: teamIds } }, employee: { employeeId: user._id })
  const scopeFilter = await buildScopeFilter(user);

  const filter = { ...scopeFilter };

  // Explicit user filter if permitted within scope
  if (userId) {
    const isAllowed = await canAccessEmployee(user, userId);
    if (isAllowed) {
      filter.employeeId = userId;
    } else {
      // Out of scope: return empty list silently
      return {
        records: [],
        meta: { page, limit, total: 0, totalPages: 0 },
      };
    }
  }

  // Role filter (admin only)
  if (role && user.role === ROLES.ADMIN) {
    const usersWithRole = await User.find({ role }).select('_id');
    const roleIds = usersWithRole.map((u) => u._id);
    if (filter.employeeId && filter.employeeId.$in) {
      const intersected = filter.employeeId.$in.filter((id) =>
        roleIds.some((rId) => rId.equals(id))
      );
      filter.employeeId = { $in: intersected };
    } else if (filter.employeeId) {
      if (!roleIds.some((rId) => rId.equals(filter.employeeId))) {
        return {
          records: [],
          meta: { page, limit, total: 0, totalPages: 0 },
        };
      }
    } else {
      filter.employeeId = { $in: roleIds };
    }
  }

  // Date range filter
  if (from || to) {
    filter.workDate = {};
    if (from) filter.workDate.$gte = from;
    if (to) filter.workDate.$lte = to;
  }

  // Status filters
  if (workingStatus) filter.workingStatus = workingStatus;
  if (verificationStatus) filter['verification.status'] = verificationStatus;
  if (overtimeStatus) filter['overtime.status'] = overtimeStatus;

  const skip = (page - 1) * limit;

  const [records, total] = await Promise.all([
    Attendance.find(filter)
      .populate('employeeId', 'name email role managerId')
      .populate('verification.reviewedBy', 'name email')
      .populate('overtime.reviewedBy', 'name email')
      .sort({ workDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Attendance.countDocuments(filter),
  ]);

  return {
    records,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get attendance record by ID (checked by scope)
 */
export const getAttendanceById = async (user, attendanceId) => {
  const record = await Attendance.findById(attendanceId)
    .populate('employeeId', 'name email role managerId')
    .populate('verification.reviewedBy', 'name email')
    .populate('overtime.reviewedBy', 'name email');

  if (!record) {
    throw new ApiError(404, 'NOT_FOUND', 'Attendance record not found');
  }

  const allowed = await canAccessEmployee(user, record.employeeId._id);
  if (!allowed) {
    // 404 NOT_FOUND so we do not reveal existence to out-of-scope callers
    throw new ApiError(404, 'NOT_FOUND', 'Attendance record not found');
  }

  return record;
};

/**
 * Streams selfie bytes after scope authorization
 */
export const getSelfieStreamData = async (user, attendanceId, kind) => {
  const record = await Attendance.findById(attendanceId).select(
    'employeeId punchIn punchOut'
  );

  if (!record) {
    throw new ApiError(404, 'NOT_FOUND', 'Attendance record not found');
  }

  const allowed = await canAccessEmployee(user, record.employeeId);
  if (!allowed) {
    throw new ApiError(404, 'NOT_FOUND', 'Attendance record not found');
  }

  const punchEvent = kind === 'punch-in' ? record.punchIn : record.punchOut;
  if (!punchEvent || !punchEvent.selfie?.publicId) {
    throw new ApiError(404, 'NOT_FOUND', `No ${kind} selfie found for this record`);
  }

  const selfieData = await getSelfie(punchEvent.selfie.publicId);
  return {
    buffer: selfieData.buffer,
    mimeType: selfieData.mimeType || punchEvent.selfie.mimeType || 'image/jpeg',
  };
};

/**
 * Review Attendance Verification (Valid or Invalid)
 */
export const reviewVerification = async ({ user, attendanceId, status, remarks }) => {
  const attendance = await Attendance.findById(attendanceId).populate('employeeId');
  if (!attendance) {
    throw new ApiError(404, 'NOT_FOUND', 'Attendance record not found');
  }

  // 1. Authorize via canReview helper
  canReview(user, attendance, attendance.employeeId);

  // 2. Reject if workingStatus is still in_progress
  if (attendance.workingStatus === WORKING_STATUS.IN_PROGRESS) {
    throw new ApiError(
      409,
      'CANNOT_REVIEW_IN_PROGRESS',
      'Cannot review attendance that is still in progress'
    );
  }

  // 3. Append to history & update current status
  attendance.verification.history.push({
    status,
    reviewedBy: user._id,
    reviewedAt: new Date(),
    remarks: remarks || null,
  });

  attendance.verification.status = status;
  attendance.verification.reviewedBy = user._id;
  attendance.verification.reviewedAt = new Date();
  attendance.verification.remarks = remarks || null;

  await attendance.save();

  // 4. Trigger notification stub
  await notifyVerificationReviewed({ attendance, reviewer: user, status });

  return Attendance.findById(attendance._id)
    .populate('employeeId', 'name email role managerId')
    .populate('verification.reviewedBy', 'name email')
    .populate('overtime.reviewedBy', 'name email');
};

/**
 * Request Overtime (Owner only)
 */
export const requestOvertime = async ({ user, attendanceId, requestedMinutes, reason }) => {
  const attendance = await Attendance.findById(attendanceId);
  if (!attendance) {
    throw new ApiError(404, 'NOT_FOUND', 'Attendance record not found');
  }

  // 1. Owner only check (out-of-scope returns 404 to hide existence)
  if (!attendance.employeeId.equals(user._id)) {
    throw new ApiError(404, 'NOT_FOUND', 'Attendance record not found');
  }

  // 2. Eligibility checks
  if (attendance.workingStatus !== WORKING_STATUS.COMPLETED) {
    throw new ApiError(
      409,
      'OVERTIME_NOT_REQUESTABLE',
      'Overtime can only be requested for completed shifts'
    );
  }

  if ((attendance.workedMinutes || 0) <= STANDARD_SHIFT_MINUTES) {
    throw new ApiError(
      409,
      'OVERTIME_NOT_REQUESTABLE',
      'Worked minutes must exceed standard shift of 480 minutes'
    );
  }

  if (attendance.verification?.status === VERIFICATION_STATUS.INVALID) {
    throw new ApiError(
      409,
      'OVERTIME_NOT_REQUESTABLE',
      'Cannot request overtime for attendance marked as invalid'
    );
  }

  if (
    attendance.overtime?.status === OVERTIME_STATUS.PENDING ||
    attendance.overtime?.status === OVERTIME_STATUS.APPROVED
  ) {
    throw new ApiError(
      409,
      'OVERTIME_NOT_REQUESTABLE',
      'Overtime is already pending or approved'
    );
  }

  const maxMinutes = (attendance.workedMinutes || 0) - STANDARD_SHIFT_MINUTES;
  if (requestedMinutes > maxMinutes) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      `Requested minutes (${requestedMinutes}) cannot exceed overtime worked minutes (${maxMinutes})`
    );
  }

  // 3. Update overtime request
  attendance.overtime.status = OVERTIME_STATUS.PENDING;
  attendance.overtime.requestedMinutes = requestedMinutes;
  attendance.overtime.reason = reason;
  attendance.overtime.requestedAt = new Date();
  attendance.overtime.reviewedBy = null;
  attendance.overtime.reviewedAt = null;
  attendance.overtime.remarks = null;

  await attendance.save();

  // 4. Trigger notification stub
  await notifyOvertimeRequested({
    attendance,
    employee: user,
    requestedMinutes,
    reason,
  });

  return Attendance.findById(attendance._id)
    .populate('employeeId', 'name email role managerId')
    .populate('verification.reviewedBy', 'name email')
    .populate('overtime.reviewedBy', 'name email');
};

/**
 * Review Overtime (Approved or Rejected)
 */
export const reviewOvertime = async ({ user, attendanceId, decision, remarks }) => {
  const attendance = await Attendance.findById(attendanceId).populate('employeeId');
  if (!attendance) {
    throw new ApiError(404, 'NOT_FOUND', 'Attendance record not found');
  }

  // 1. Authorize via canReview
  canReview(user, attendance, attendance.employeeId);

  // 2. Only pending overtime can be reviewed
  if (attendance.overtime?.status !== OVERTIME_STATUS.PENDING) {
    throw new ApiError(
      409,
      'INVALID_TRANSITION',
      'Only pending overtime requests can be reviewed'
    );
  }

  // 3. Approving when verification is invalid is blocked
  if (decision === 'approved' && attendance.verification?.status === VERIFICATION_STATUS.INVALID) {
    throw new ApiError(
      409,
      'ATTENDANCE_INVALID',
      'Cannot approve overtime for attendance marked as invalid'
    );
  }

  const targetStatus =
    decision === 'approved' ? OVERTIME_STATUS.APPROVED : OVERTIME_STATUS.REJECTED;

  // 4. Append to history & update state
  attendance.overtime.history.push({
    status: targetStatus,
    requestedMinutes: attendance.overtime.requestedMinutes,
    reason: attendance.overtime.reason,
    requestedAt: attendance.overtime.requestedAt,
    reviewedBy: user._id,
    reviewedAt: new Date(),
    remarks: remarks || null,
  });

  attendance.overtime.status = targetStatus;
  attendance.overtime.reviewedBy = user._id;
  attendance.overtime.reviewedAt = new Date();
  attendance.overtime.remarks = remarks || null;

  await attendance.save();

  // 5. Trigger notification stub
  await notifyOvertimeReviewed({ attendance, reviewer: user, decision });

  return Attendance.findById(attendance._id)
    .populate('employeeId', 'name email role managerId')
    .populate('verification.reviewedBy', 'name email')
    .populate('overtime.reviewedBy', 'name email');
};

/**
 * List Pending Overtime Requests in Scope
 */
export const listPendingOvertime = async (user, query) => {
  const { page = 1, limit = 20 } = query;
  const scopeFilter = await buildScopeFilter(user);

  const filter = {
    ...scopeFilter,
    'overtime.status': OVERTIME_STATUS.PENDING,
  };

  // Reviewer cannot review own record: exclude self from queue
  if (filter.employeeId && filter.employeeId.$in) {
    filter.employeeId.$in = filter.employeeId.$in.filter(
      (id) => id.toString() !== user._id.toString()
    );
  } else if (!filter.employeeId) {
    filter.employeeId = { $ne: user._id };
  }

  const skip = (page - 1) * limit;

  const [records, total] = await Promise.all([
    Attendance.find(filter)
      .populate('employeeId', 'name email role managerId')
      .populate('verification.reviewedBy', 'name email')
      .populate('overtime.reviewedBy', 'name email')
      .sort({ 'overtime.requestedAt': -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Attendance.countDocuments(filter),
  ]);

  return {
    records,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

