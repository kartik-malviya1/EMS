import { Attendance } from '../models/attendance.model.js';
import { Notification } from '../models/notification.model.js';
import { WORKING_STATUS, NOTIFICATION_TYPES, ROLES } from '../config/constants.js';
import { getWorkDate } from '../utils/time.js';
import { notifyMissedPunchOut } from '../services/notification.service.js';
import { logger } from '../utils/logger.js';

/**
 * Pure job function: finds open attendance records for today and generates
 * idempotent missed punch-out alerts for the employees.
 */
export const runMissedPunchOutJob = async (customDate = null) => {
  const dateObj = customDate
    ? customDate instanceof Date
      ? customDate
      : new Date(customDate)
    : new Date();
  const todayWorkDate = getWorkDate(dateObj);

  const openRecords = await Attendance.find({
    workDate: todayWorkDate,
    workingStatus: WORKING_STATUS.IN_PROGRESS,
  }).populate('employeeId');

  let alertedCount = 0;

  for (const record of openRecords) {
    if (
      record.employeeId &&
      record.employeeId.isActive &&
      [ROLES.EMPLOYEE, ROLES.MANAGER].includes(record.employeeId.role)
    ) {
      const existing = await Notification.findOne({
        userId: record.employeeId._id,
        type: NOTIFICATION_TYPES.MISSED_PUNCH_OUT,
        'data.attendanceId': record._id,
      });

      if (!existing) {
        await notifyMissedPunchOut({ user: record.employeeId, attendance: record });
        alertedCount++;
      }
    }
  }

  logger.info(
    `runMissedPunchOutJob: checked ${openRecords.length} open records, created ${alertedCount} alerts for ${todayWorkDate}`
  );

  return { checkedCount: openRecords.length, alertedCount };
};

export default {
  runMissedPunchOutJob,
};
