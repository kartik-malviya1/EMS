import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/user.model.js';
import { Attendance } from '../models/attendance.model.js';
import { ROLES } from '../config/constants.js';
import { logger } from '../utils/logger.js';

dotenv.config();

export const purgeAdminAttendance = async () => {
  const isConfirm = process.argv.includes('--confirm');

  try {
    await connectDB();

    const admins = await User.find({ role: ROLES.ADMIN }).select('_id name email');
    const adminIds = admins.map((a) => a._id);

    if (adminIds.length === 0) {
      logger.info('No admin users found in database.');
      await disconnectDB();
      return { found: 0, deleted: 0 };
    }

    const records = await Attendance.find({ employeeId: { $in: adminIds } }).populate(
      'employeeId',
      'name email role'
    );

    logger.info(
      `[purge-admin-attendance] Found ${records.length} attendance record(s) belonging to ${admins.length} administrator(s).`
    );

    for (const rec of records) {
      const emp = rec.employeeId;
      logger.info(
        ` - Attendance ID: ${rec._id}, WorkDate: ${rec.workDate}, Status: ${rec.workingStatus}, Admin: ${emp?.name} (${emp?.email})`
      );
    }

    let deletedCount = 0;
    if (isConfirm) {
      if (records.length > 0) {
        const deleteRes = await Attendance.deleteMany({ employeeId: { $in: adminIds } });
        deletedCount = deleteRes.deletedCount || 0;
        logger.info(`[purge-admin-attendance] Deleted ${deletedCount} admin attendance records.`);
      } else {
        logger.info('[purge-admin-attendance] Nothing to delete.');
      }
    } else {
      logger.info(
        '[purge-admin-attendance] Dry run only. Pass --confirm to delete these records.'
      );
    }

    await disconnectDB();
    return { found: records.length, deleted: deletedCount };
  } catch (error) {
    logger.error('Error during purgeAdminAttendance:', error);
    await disconnectDB();
    process.exit(1);
  }
};

if (process.argv[1]?.endsWith('purge-admin-attendance.js')) {
  purgeAdminAttendance().then(() => process.exit(0));
}

export default purgeAdminAttendance;
