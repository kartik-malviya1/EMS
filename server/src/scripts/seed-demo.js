import dotenv from 'dotenv';
import { env } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/user.model.js';
import { ROLES } from '../config/constants.js';
import { logger } from '../utils/logger.js';

dotenv.config();

export const seedDemo = async () => {
  if (env.NODE_ENV === 'production') {
    logger.error('seed:demo cannot be run in production mode!');
    process.exit(1);
  }

  try {
    await connectDB();

    const demoPassword = process.env.DEMO_PASSWORD || 'DemoPassword123';
    const passwordHash = await User.hashPassword(demoPassword);

    // 1. Create or ensure Demo Admin
    let admin = await User.findOne({ email: 'demo.admin@example.com' });
    if (!admin) {
      admin = await User.create({
        name: 'Demo Admin',
        email: 'demo.admin@example.com',
        passwordHash,
        role: ROLES.ADMIN,
        managerId: null,
        isActive: true,
      });
      logger.info('Created Demo Admin: demo.admin@example.com');
    }

    // 2. Create 2 Managers
    let manager1 = await User.findOne({ email: 'manager.sarah@example.com' });
    if (!manager1) {
      manager1 = await User.create({
        name: 'Sarah Connor (Engineering Mgr)',
        email: 'manager.sarah@example.com',
        passwordHash,
        role: ROLES.MANAGER,
        managerId: null,
        isActive: true,
      });
      logger.info('Created Demo Manager 1: manager.sarah@example.com');
    }

    let manager2 = await User.findOne({ email: 'manager.david@example.com' });
    if (!manager2) {
      manager2 = await User.create({
        name: 'David Miller (Operations Mgr)',
        email: 'manager.david@example.com',
        passwordHash,
        role: ROLES.MANAGER,
        managerId: null,
        isActive: true,
      });
      logger.info('Created Demo Manager 2: manager.david@example.com');
    }

    // 3. Create 6 Employees (3 per manager)
    const employeesData = [
      { name: 'Alice Walker', email: 'alice.walker@example.com', managerId: manager1._id },
      { name: 'Bob Roberts', email: 'bob.roberts@example.com', managerId: manager1._id },
      { name: 'Charlie Clark', email: 'charlie.clark@example.com', managerId: manager1._id },
      { name: 'Diana Prince', email: 'diana.prince@example.com', managerId: manager2._id },
      { name: 'Ethan Hunt', email: 'ethan.hunt@example.com', managerId: manager2._id },
      { name: 'Fiona Gallagher', email: 'fiona.gallagher@example.com', managerId: manager2._id },
    ];

    for (const emp of employeesData) {
      const existing = await User.findOne({ email: emp.email });
      if (!existing) {
        await User.create({
          name: emp.name,
          email: emp.email,
          passwordHash,
          role: ROLES.EMPLOYEE,
          managerId: emp.managerId,
          isActive: true,
        });
        logger.info(`Created Demo Employee: ${emp.email}`);
      }
    }

    logger.info('Demo user seeding completed successfully (attendance records will be added in Phase 3).');
    await disconnectDB();
  } catch (error) {
    logger.error('Error seeding demo users:', error);
    await disconnectDB();
    process.exit(1);
  }
};

// If run directly
if (process.argv[1]?.endsWith('seed-demo.js')) {
  seedDemo().then(() => process.exit(0));
}

export default seedDemo;
