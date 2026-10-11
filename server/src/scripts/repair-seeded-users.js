import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/user.model.js';
import { logger } from '../utils/logger.js';

dotenv.config();

export const repairSeededUsers = async () => {
  const isConfirm = process.argv.includes('--confirm');

  try {
    await connectDB();

    const seededEmails = [
      'demo.admin@example.com',
      'manager.sarah@example.com',
      'manager.david@example.com',
      'alice.walker@example.com',
      'bob.roberts@example.com',
      'charlie.clark@example.com',
      'diana.prince@example.com',
      'ethan.hunt@example.com',
      'fiona.gallagher@example.com',
    ];

    const users = await User.find({ email: { $in: seededEmails } });
    const toRepair = users.filter((u) => u.accountStatus !== 'active' || !u.isActive);

    logger.info(`Found ${users.length} seeded users in database.`);
    if (toRepair.length === 0) {
      logger.info('All seeded accounts already have accountStatus: "active" and isActive: true.');
      await disconnectDB();
      return;
    }

    logger.info(`Found ${toRepair.length} seeded account(s) needing status repair:`);
    for (const u of toRepair) {
      logger.info(`  - ${u.email} (current accountStatus: "${u.accountStatus}", isActive: ${u.isActive})`);
    }

    if (!isConfirm) {
      logger.info('\nDRY RUN: No modifications applied. Run with --confirm to apply repairs.');
      await disconnectDB();
      return;
    }

    const result = await User.updateMany(
      { email: { $in: toRepair.map((u) => u.email) } },
      { $set: { accountStatus: 'active', isActive: true } }
    );

    logger.info(`Successfully repaired ${result.modifiedCount} account(s) to active status.`);
    await disconnectDB();
  } catch (err) {
    logger.error('Failed to repair seeded users:', err);
    await disconnectDB();
    process.exit(1);
  }
};

if (process.argv[1]?.endsWith('repair-seeded-users.js')) {
  repairSeededUsers().then(() => process.exit(0));
}

export default repairSeededUsers;
