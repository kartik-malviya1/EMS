import { User } from '../models/user.model.js';
import { Attendance } from '../models/attendance.model.js';
import { Notification } from '../models/notification.model.js';
import { ROLES, NOTIFICATION_TYPES } from '../config/constants.js';
import { getWorkDate, isWorkingDay } from '../utils/time.js';
import { notifyMissedPunchIn } from '../services/notification.service.js';
import { logger } from '../utils/logger.js';

/**
 * Pure job function: finds active employees who haven't punched in today (on working days)
 * and generates idempotent missed punch-in alerts.
 */
export const runMissedPunchInJob = async (customDate = null, forceWorkingDay = false) => {
  const dateObj = customDate
    ? customDate instanceof Date
      ? customDate
      : new Date(customDate)
    : new Date();
  const todayWorkDate = getWorkDate(dateObj);

  if (!forceWorkingDay && !isWorkingDay(dateObj)) {
    logger.info(`runMissedPunchInJob: Skipping non-working day (${todayWorkDate})`);
    return { checkedCount: 0, alertedCount: 0, skipped: true };
  }

  const employees = await User.find({
    role: { $in: [ROLES.EMPLOYEE, ROLES.MANAGER] },
    isActive: true,
  });

  let alertedCount = 0;

  for (const employee of employees) {
    const record = await Attendance.findOne({
      employeeId: employee._id,
      workDate: todayWorkDate,
    });

    if (!record) {
      const existing = await Notification.findOne({
        userId: employee._id,
        type: NOTIFICATION_TYPES.MISSED_PUNCH_IN,
        'data.workDate': todayWorkDate,
      });

      if (!existing) {
        await notifyMissedPunchIn({ user: employee, workDate: todayWorkDate });
        alertedCount++;
      }
    }
  }

  logger.info(
    `runMissedPunchInJob: checked ${employees.length} employees, created ${alertedCount} alerts for ${todayWorkDate}`
  );

  return { checkedCount: employees.length, alertedCount, skipped: false };
};

export default {
  runMissedPunchInJob,
};
