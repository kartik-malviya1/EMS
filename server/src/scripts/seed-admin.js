import dotenv from 'dotenv';
import { env } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/user.model.js';
import { ROLES } from '../config/constants.js';
import { logger } from '../utils/logger.js';

dotenv.config();

const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

export const seedAdmin = async () => {
  try {
    await connectDB();

    const adminEmail = (env.ADMIN_EMAIL || 'admin@example.com').toLowerCase().trim();
    const adminName = (env.ADMIN_NAME || 'System Administrator').trim();
    const adminPassword = env.ADMIN_PASSWORD || 'AdminPassword123';

    // 1. Idempotency check: if admin email already exists, do nothing
    const existing = await User.findOne({ email: adminEmail });
    if (existing) {
      logger.info(`Admin user with email ${adminEmail} already exists. Skipping.`);
      await disconnectDB();
      return;
    }

    // 2. Refuse weak password
    if (!passwordRegex.test(adminPassword)) {
      logger.error(
        'Admin password does not meet policy requirements (8-72 chars, at least one letter and one number).'
      );
      await disconnectDB();
      process.exit(1);
    }

    // 3. Hash and create admin
    const passwordHash = await User.hashPassword(adminPassword);
    const admin = await User.create({
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: ROLES.ADMIN,
      managerId: null,
      isActive: true,
    });

    logger.info(`Admin user successfully seeded: ${admin.email} (${admin._id})`);
    await disconnectDB();
  } catch (error) {
    logger.error('Error seeding admin user:', error);
    await disconnectDB();
    process.exit(1);
  }
};

// If run directly
if (process.argv[1]?.endsWith('seed-admin.js')) {
  seedAdmin().then(() => process.exit(0));
}

export default seedAdmin;
