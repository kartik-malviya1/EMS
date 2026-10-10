import dotenv from 'dotenv';
import { DateTime } from 'luxon';
import { env } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/user.model.js';
import { Attendance } from '../models/attendance.model.js';
import {
  ROLES,
  WORKING_STATUS,
  VERIFICATION_STATUS,
  CLOSED_BY,
} from '../config/constants.js';
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

    // 1. Create Demo Admin
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

    const employees = [];
    for (const emp of employeesData) {
      let user = await User.findOne({ email: emp.email });
      if (!user) {
        user = await User.create({
          name: emp.name,
          email: emp.email,
          passwordHash,
          role: ROLES.EMPLOYEE,
          managerId: emp.managerId,
          isActive: true,
        });
        logger.info(`Created Demo Employee: ${emp.email}`);
      }
      employees.push(user);
    }

    // 4. Generate 14 days of varied attendance records for each employee
    const zone = env.BUSINESS_TIMEZONE || 'Asia/Kolkata';
    const now = DateTime.now().setZone(zone);

    let seededCount = 0;

    for (const emp of employees) {
      for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
        const day = now.minus({ days: dayOffset });
        const workDate = day.toFormat('yyyy-MM-dd');

        // Check if attendance already exists
        const existing = await Attendance.findOne({ employeeId: emp._id, workDate });
        if (existing) continue;

        // Vary status across days
        const pattern = (dayOffset + emp.name.length) % 5;

        if (pattern === 0) {
          // Missed record
          await Attendance.create({
            employeeId: emp._id,
            workDate,
            punchIn: {
              at: day.set({ hour: 9, minute: 0, second: 0 }).toJSDate(),
              selfie: null,
              location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
            },
            punchOut: null,
            workedMinutes: 0,
            workingStatus: WORKING_STATUS.MISSED,
            closedBy: CLOSED_BY.SYSTEM,
          });
          seededCount++;
        } else if (pattern === 1) {
          // Incomplete record (e.g. 360 mins = 6 hours)
          const inAt = day.set({ hour: 9, minute: 30, second: 0 }).toJSDate();
          const outAt = day.set({ hour: 15, minute: 30, second: 0 }).toJSDate();
          await Attendance.create({
            employeeId: emp._id,
            workDate,
            punchIn: {
              at: inAt,
              selfie: null,
              location: { latitude: 28.6139, longitude: 77.209, accuracy: 12 },
            },
            punchOut: {
              at: outAt,
              selfie: null,
              location: { latitude: 28.6139, longitude: 77.209, accuracy: 14 },
            },
            workedMinutes: 360,
            workingStatus: WORKING_STATUS.INCOMPLETE,
            closedBy: CLOSED_BY.EMPLOYEE,
            verification: {
              status: VERIFICATION_STATUS.VALID,
              reviewedBy: emp.managerId,
              reviewedAt: day.set({ hour: 18, minute: 0 }).toJSDate(),
              remarks: 'Approved half day',
            },
          });
          seededCount++;
        } else if (pattern === 2) {
          // Completed with Overtime & Invalid verification
          const inAt = day.set({ hour: 9, minute: 0 }).toJSDate();
          const outAt = day.set({ hour: 18, minute: 30 }).toJSDate(); // 570 mins
          await Attendance.create({
            employeeId: emp._id,
            workDate,
            punchIn: {
              at: inAt,
              selfie: null,
              location: { latitude: 28.6139, longitude: 77.209, accuracy: 8 },
            },
            punchOut: {
              at: outAt,
              selfie: null,
              location: { latitude: 28.6139, longitude: 77.209, accuracy: 8 },
            },
            workedMinutes: 570,
            workingStatus: WORKING_STATUS.COMPLETED,
            closedBy: CLOSED_BY.EMPLOYEE,
            verification: {
              status: VERIFICATION_STATUS.INVALID,
              reviewedBy: emp.managerId,
              reviewedAt: day.set({ hour: 19, minute: 0 }).toJSDate(),
              remarks: 'Location discrepancy noted during punch out',
            },
          });
          seededCount++;
        } else {
          // Standard Completed record (e.g. 500 mins) with Valid verification
          const inAt = day.set({ hour: 9, minute: 0 }).toJSDate();
          const outAt = day.set({ hour: 17, minute: 20 }).toJSDate();
          await Attendance.create({
            employeeId: emp._id,
            workDate,
            punchIn: {
              at: inAt,
              selfie: null,
              location: { latitude: 28.6139, longitude: 77.209, accuracy: 9 },
            },
            punchOut: {
              at: outAt,
              selfie: null,
              location: { latitude: 28.6139, longitude: 77.209, accuracy: 11 },
            },
            workedMinutes: 500,
            workingStatus: WORKING_STATUS.COMPLETED,
            closedBy: CLOSED_BY.EMPLOYEE,
            verification: {
              status: VERIFICATION_STATUS.VALID,
              reviewedBy: emp.managerId,
              reviewedAt: day.set({ hour: 18, minute: 30 }).toJSDate(),
              remarks: 'Verified normal shift',
            },
          });
          seededCount++;
        }
      }
    }

    logger.info(`Seeded ${seededCount} varied attendance records across 14 days.`);
    await disconnectDB();
  } catch (error) {
    logger.error('Error seeding demo users & attendance:', error);
    await disconnectDB();
    process.exit(1);
  }
};

if (process.argv[1]?.endsWith('seed-demo.js')) {
  seedDemo().then(() => process.exit(0));
}

export default seedDemo;
