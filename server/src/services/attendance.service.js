import { Attendance } from '../models/attendance.model.js';
import { User } from '../models/user.model.js';
import {
  WORKING_STATUS,
  CLOSED_BY,
  STANDARD_SHIFT_MINUTES,
  ROLES,
} from '../config/constants.js';
import { getWorkDate, calculateWorkedMinutes } from '../utils/time.js';
import { getGeofenceSettings } from './settings.service.js';
import { evaluateGeofence } from './geofence.service.js';
import { uploadSelfie, getSelfie, deleteSelfie } from './storage.service.js';
import { buildScopeFilter, canAccessEmployee } from './scope.service.js';
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
