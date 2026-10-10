import { Attendance } from '../models/attendance.model.js';
import { WORKING_STATUS, CLOSED_BY } from '../config/constants.js';
import { getWorkDate } from '../utils/time.js';
import { notifyAutoClose } from '../services/notification.service.js';
import { logger } from '../utils/logger.js';

/**
 * Pure job function: finds any in_progress attendance records with workDate < today,
 * auto-closes them as missed, and notifies the employee and their manager.
 */
export const runAutoCloseJob = async (currentDate = null) => {
  const dateObj = currentDate
    ? currentDate instanceof Date
      ? currentDate
      : new Date(currentDate)
    : new Date();
  const todayWorkDate = getWorkDate(dateObj);

  const expiredRecords = await Attendance.find({
    workDate: { $lt: todayWorkDate },
    workingStatus: WORKING_STATUS.IN_PROGRESS,
  }).populate('employeeId');

  let closedCount = 0;

  for (const record of expiredRecords) {
    record.workingStatus = WORKING_STATUS.MISSED;
    record.workedMinutes = 0;
    record.closedBy = CLOSED_BY.SYSTEM;
    await record.save();

    await notifyAutoClose({ attendance: record });
    closedCount++;
  }

  logger.info(
    `runAutoCloseJob: closed and alerted ${closedCount} expired records relative to ${todayWorkDate}`
  );

  return { closedCount };
};

export default {
  runAutoCloseJob,
};
