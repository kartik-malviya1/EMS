import cron from 'node-cron';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { runMissedPunchInJob } from './missedPunchIn.job.js';
import { runMissedPunchOutJob } from './missedPunchOut.job.js';
import { runAutoCloseJob } from './autoClose.job.js';

const parseTimeToCron = (timeStr) => {
  const [hour, minute] = timeStr.split(':').map((val) => parseInt(val.trim(), 10));
  return `${minute} ${hour} * * *`;
};

export const initCronJobs = () => {
  if (!env.ENABLE_CRON) {
    logger.info('Cron jobs disabled by ENABLE_CRON=false');
    return [];
  }

  const timezone = env.BUSINESS_TIMEZONE || 'Asia/Kolkata';
  const tasks = [];

  // 1. Missed punch-in alert
  const missedPunchInExpr = parseTimeToCron(env.MISSED_PUNCH_IN_ALERT_TIME || '11:00');
  const task1 = cron.schedule(
    missedPunchInExpr,
    async () => {
      try {
        await runMissedPunchInJob();
      } catch (err) {
        logger.error('Error running missed punch in job:', err.message);
      }
    },
    { timezone }
  );
  tasks.push(task1);

  // 2. Missed punch-out alert
  const missedPunchOutExpr = parseTimeToCron(env.MISSED_PUNCH_OUT_ALERT_TIME || '20:00');
  const task2 = cron.schedule(
    missedPunchOutExpr,
    async () => {
      try {
        await runMissedPunchOutJob();
      } catch (err) {
        logger.error('Error running missed punch out job:', err.message);
      }
    },
    { timezone }
  );
  tasks.push(task2);

  // 3. Auto-close job
  const autoCloseExpr = parseTimeToCron(env.AUTO_CLOSE_TIME || '00:10');
  const task3 = cron.schedule(
    autoCloseExpr,
    async () => {
      try {
        await runAutoCloseJob();
      } catch (err) {
        logger.error('Error running auto close job:', err.message);
      }
    },
    { timezone }
  );
  tasks.push(task3);

  logger.info(`Scheduled 3 cron jobs in timezone ${timezone}:
  - Missed Punch-In: ${env.MISSED_PUNCH_IN_ALERT_TIME} (${missedPunchInExpr})
  - Missed Punch-Out: ${env.MISSED_PUNCH_OUT_ALERT_TIME} (${missedPunchOutExpr})
  - Auto-Close: ${env.AUTO_CLOSE_TIME} (${autoCloseExpr})`);

  return tasks;
};

export { runMissedPunchInJob, runMissedPunchOutJob, runAutoCloseJob };

export default {
  initCronJobs,
  runMissedPunchInJob,
  runMissedPunchOutJob,
  runAutoCloseJob,
};
