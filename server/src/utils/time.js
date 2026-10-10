import { DateTime } from 'luxon';
import { env } from '../config/env.js';

export const getBusinessTimezone = () => env.BUSINESS_TIMEZONE || 'Asia/Kolkata';

export const nowInBusinessTime = (zone = getBusinessTimezone()) => {
  return DateTime.now().setZone(zone);
};

export const getWorkDate = (date = new Date(), zone = getBusinessTimezone()) => {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  const jsDate = date instanceof Date ? date : new Date(date);
  return DateTime.fromJSDate(jsDate).setZone(zone).toFormat('yyyy-MM-dd');
};

export const getBusinessDayBoundaries = (workDate, zone = getBusinessTimezone()) => {
  const dt = DateTime.fromFormat(workDate, 'yyyy-MM-dd', { zone });
  if (!dt.isValid) {
    throw new Error(`Invalid workDate format: ${workDate}`);
  }
  const startOfDay = dt.startOf('day').toJSDate();
  const endOfDay = dt.endOf('day').toJSDate();
  return { startOfDay, endOfDay };
};

export const calculateWorkedMinutes = (punchInAt, punchOutAt) => {
  if (!punchInAt || !punchOutAt) return null;
  const inMs = new Date(punchInAt).getTime();
  const outMs = new Date(punchOutAt).getTime();
  if (outMs <= inMs) return 0;
  return Math.floor((outMs - inMs) / 60000);
};

export const isWorkingDay = (date = new Date(), zone = getBusinessTimezone(), workingDaysStr = env.WORKING_DAYS) => {
  const dt = DateTime.fromJSDate(date instanceof Date ? date : new Date(date)).setZone(zone);
  const allowedDays = (workingDaysStr || '1,2,3,4,5').split(',').map((d) => parseInt(d.trim(), 10));
  return allowedDays.includes(dt.weekday);
};
