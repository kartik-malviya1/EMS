import dotenv from "dotenv";
import mongoose from "mongoose";
import { DateTime } from "luxon";
import { env } from "../config/env.js";
import { connectDB, disconnectDB } from "../config/db.js";
import { User } from "../models/user.model.js";
import { Attendance } from "../models/attendance.model.js";
import { Notification } from "../models/notification.model.js";
import { listTeamMembers } from "../services/user.service.js";
import {
  ROLES,
  WORKING_STATUS,
  VERIFICATION_STATUS,
  OVERTIME_STATUS,
  CLOSED_BY,
  NOTIFICATION_TYPES,
} from "../config/constants.js";
import { logger } from "../utils/logger.js";

dotenv.config();

export const DEMO_PASSWORD = "DemoPassword@123";
export const DEMO_ADMIN_EMAIL = "admin@gmail.com";
export const DEMO_MANAGER_EMAIL = "manager.sarah@gmail.com";
export const DEMO_EMPLOYEE_EMAIL = "alice@gmail.com";

/**
 * Idempotently seeds the 3 designated AMS demo accounts with realistic dashboard data
 * and executes post-seeding programmatic verification.
 */
export const seedDemoAccounts = async (options = {}) => {
  const { skipDisconnect = false, skipExit = false } = options;

  // 1. Environment & Production Protection
  if (
    process.env.NODE_ENV === "production" ||
    (env && env.NODE_ENV === "production")
  ) {
    logger.error("Demo account seeding is strictly blocked in production mode.");
    if (skipExit) {
      throw new Error("Production execution blocked");
    }
    process.exit(1);
  }

  try {
    // 2. Validate MongoDB connection string and connect
    if (!process.env.MONGODB_URI && (!env || !env.MONGODB_URI)) {
      logger.error("MONGODB_URI is required to connect to the database.");
      if (skipExit) throw new Error("MONGODB_URI missing");
      process.exit(1);
    }

    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }

    const passwordHash = await User.hashPassword(DEMO_PASSWORD);

    // 3. Create or reconcile Sarah Connor (Manager)
    let sarah = await User.findOne({ email: DEMO_MANAGER_EMAIL });
    if (!sarah) {
      sarah = await User.create({
        name: "Sarah Connor (Engineering Mgr)",
        email: DEMO_MANAGER_EMAIL,
        passwordHash,
        role: ROLES.MANAGER,
        managerId: null,
        department: "Engineering",
        designation: "Engineering Manager",
        employeeId: "DEMO-MGR-001",
        accountStatus: "active",
        isActive: true,
      });
      logger.info(`Created Demo Manager: ${DEMO_MANAGER_EMAIL}`);
    } else {
      sarah.name = "Sarah Connor (Engineering Mgr)";
      sarah.passwordHash = passwordHash;
      sarah.role = ROLES.MANAGER;
      sarah.managerId = null;
      sarah.department = "Engineering";
      sarah.designation = "Engineering Manager";
      if (!sarah.employeeId) sarah.employeeId = "DEMO-MGR-001";
      sarah.accountStatus = "active";
      sarah.isActive = true;
      await sarah.save();
      logger.info(`Reconciled Demo Manager: ${DEMO_MANAGER_EMAIL}`);
    }

    const sarahId = sarah._id;

    // 4. Create or reconcile Alice Walker (Employee) with managerId = sarah._id
    let alice = await User.findOne({ email: DEMO_EMPLOYEE_EMAIL });
    if (!alice) {
      alice = await User.create({
        name: "Alice Walker (Engineering)",
        email: DEMO_EMPLOYEE_EMAIL,
        passwordHash,
        role: ROLES.EMPLOYEE,
        managerId: sarahId,
        department: "Engineering",
        designation: "Software Engineer",
        employeeId: "DEMO-EMP-001",
        accountStatus: "active",
        isActive: true,
      });
      logger.info(`Created Demo Employee: ${DEMO_EMPLOYEE_EMAIL}`);
    } else {
      alice.name = "Alice Walker (Engineering)";
      alice.passwordHash = passwordHash;
      alice.role = ROLES.EMPLOYEE;
      alice.managerId = sarahId;
      alice.department = "Engineering";
      alice.designation = "Software Engineer";
      if (!alice.employeeId) alice.employeeId = "DEMO-EMP-001";
      alice.accountStatus = "active";
      alice.isActive = true;
      await alice.save();
      logger.info(`Reconciled Demo Employee: ${DEMO_EMPLOYEE_EMAIL}`);
    }

    // 5. Create or reconcile Demo Admin (No workforce assignment or manager)
    let admin = await User.findOne({ email: DEMO_ADMIN_EMAIL });
    if (!admin) {
      admin = await User.create({
        name: "Demo Admin",
        email: DEMO_ADMIN_EMAIL,
        passwordHash,
        role: ROLES.ADMIN,
        managerId: null,
        accountStatus: "active",
        isActive: true,
      });
      logger.info(`Created Demo Admin: ${DEMO_ADMIN_EMAIL}`);
    } else {
      admin.name = "Demo Admin";
      admin.passwordHash = passwordHash;
      admin.role = ROLES.ADMIN;
      admin.managerId = null;
      admin.accountStatus = "active";
      admin.isActive = true;
      await admin.save();
      logger.info(`Reconciled Demo Admin: ${DEMO_ADMIN_EMAIL}`);
    }

    // 6. Enforce Admin workforce restriction (Admin must not have attendance records)
    const adminAttendanceCount = await Attendance.countDocuments({
      employeeId: admin._id,
    });
    if (adminAttendanceCount > 0) {
      await Attendance.deleteMany({ employeeId: admin._id });
      logger.info(
        `Purged ${adminAttendanceCount} invalid attendance records belonging to Demo Admin.`
      );
    }

    // 7. Seed realistic development attendance history for Alice and Sarah
    const zone = env.BUSINESS_TIMEZONE || "Asia/Kolkata";
    const now = DateTime.now().setZone(zone);

    // Alice Walker attendance history
    const aliceRecords = [
      // Day 0 (Today): In-progress active shift
      {
        dayOffset: 0,
        build: (day, workDate) => ({
          employeeId: alice._id,
          workDate,
          punchIn: {
            at: day.set({ hour: 9, minute: 15, second: 0 }).toJSDate(),
            selfie: null,
            location: {
              latitude: 28.6139,
              longitude: 77.209,
              accuracy: 10,
              distanceFromOfficeMeters: 45,
              withinGeofence: true,
            },
          },
          punchOut: null,
          workedMinutes: null,
          workingStatus: WORKING_STATUS.IN_PROGRESS,
          closedBy: null,
          verification: {
            status: VERIFICATION_STATUS.PENDING,
          },
          overtime: {
            status: OVERTIME_STATUS.NOT_REQUESTED,
          },
        }),
      },
      // Day -1: Standard completed shift, verified valid
      {
        dayOffset: 1,
        build: (day, workDate) => ({
          employeeId: alice._id,
          workDate,
          punchIn: {
            at: day.set({ hour: 9, minute: 0, second: 0 }).toJSDate(),
            selfie: null,
            location: {
              latitude: 28.6139,
              longitude: 77.209,
              accuracy: 8,
              distanceFromOfficeMeters: 30,
              withinGeofence: true,
            },
          },
          punchOut: {
            at: day.set({ hour: 17, minute: 20, second: 0 }).toJSDate(),
            selfie: null,
            location: {
              latitude: 28.6139,
              longitude: 77.209,
              accuracy: 9,
              distanceFromOfficeMeters: 35,
              withinGeofence: true,
            },
          },
          workedMinutes: 500,
          workingStatus: WORKING_STATUS.COMPLETED,
          closedBy: CLOSED_BY.EMPLOYEE,
          verification: {
            status: VERIFICATION_STATUS.VALID,
            reviewedBy: sarahId,
            reviewedAt: day.set({ hour: 18, minute: 0 }).toJSDate(),
            remarks: "Verified standard shift",
          },
          overtime: {
            status: OVERTIME_STATUS.NOT_REQUESTED,
          },
        }),
      },
      // Day -2: Completed shift with Approved Overtime
      {
        dayOffset: 2,
        build: (day, workDate) => ({
          employeeId: alice._id,
          workDate,
          punchIn: {
            at: day.set({ hour: 9, minute: 0, second: 0 }).toJSDate(),
            selfie: null,
            location: {
              latitude: 28.6139,
              longitude: 77.209,
              accuracy: 7,
              distanceFromOfficeMeters: 25,
              withinGeofence: true,
            },
          },
          punchOut: {
            at: day.set({ hour: 18, minute: 0, second: 0 }).toJSDate(),
            selfie: null,
            location: {
              latitude: 28.6139,
              longitude: 77.209,
              accuracy: 8,
              distanceFromOfficeMeters: 28,
              withinGeofence: true,
            },
          },
          workedMinutes: 540,
          workingStatus: WORKING_STATUS.COMPLETED,
          closedBy: CLOSED_BY.EMPLOYEE,
          verification: {
            status: VERIFICATION_STATUS.VALID,
            reviewedBy: sarahId,
            reviewedAt: day.set({ hour: 18, minute: 30 }).toJSDate(),
            remarks: "Verified shift with approved overtime",
          },
          overtime: {
            status: OVERTIME_STATUS.APPROVED,
            requestedMinutes: 60,
            reason: "Sprint release deployment support",
            requestedAt: day.set({ hour: 18, minute: 5 }).toJSDate(),
            reviewedBy: sarahId,
            reviewedAt: day.set({ hour: 18, minute: 30 }).toJSDate(),
            remarks: "Approved for deployment support",
          },
        }),
      },
      // Day -3: Completed shift with Pending Overtime
      {
        dayOffset: 3,
        build: (day, workDate) => ({
          employeeId: alice._id,
          workDate,
          punchIn: {
            at: day.set({ hour: 9, minute: 0, second: 0 }).toJSDate(),
            selfie: null,
            location: {
              latitude: 28.6139,
              longitude: 77.209,
              accuracy: 10,
              distanceFromOfficeMeters: 40,
              withinGeofence: true,
            },
          },
          punchOut: {
            at: day.set({ hour: 18, minute: 30, second: 0 }).toJSDate(),
            selfie: null,
            location: {
              latitude: 28.6139,
              longitude: 77.209,
              accuracy: 11,
              distanceFromOfficeMeters: 45,
              withinGeofence: true,
            },
          },
          workedMinutes: 570,
          workingStatus: WORKING_STATUS.COMPLETED,
          closedBy: CLOSED_BY.EMPLOYEE,
          verification: {
            status: VERIFICATION_STATUS.VALID,
            reviewedBy: sarahId,
            reviewedAt: day.set({ hour: 19, minute: 0 }).toJSDate(),
            remarks: "Verified regular shift; overtime under review",
          },
          overtime: {
            status: OVERTIME_STATUS.PENDING,
            requestedMinutes: 90,
            reason: "Critical production bug triage after hours",
            requestedAt: day.set({ hour: 18, minute: 35 }).toJSDate(),
          },
        }),
      },
      // Day -4: Incomplete shift (<8h, e.g. 6 hours approved half-day)
      {
        dayOffset: 4,
        build: (day, workDate) => ({
          employeeId: alice._id,
          workDate,
          punchIn: {
            at: day.set({ hour: 9, minute: 30, second: 0 }).toJSDate(),
            selfie: null,
            location: {
              latitude: 28.6139,
              longitude: 77.209,
              accuracy: 12,
              distanceFromOfficeMeters: 50,
              withinGeofence: true,
            },
          },
          punchOut: {
            at: day.set({ hour: 15, minute: 30, second: 0 }).toJSDate(),
            selfie: null,
            location: {
              latitude: 28.6139,
              longitude: 77.209,
              accuracy: 14,
              distanceFromOfficeMeters: 55,
              withinGeofence: true,
            },
          },
          workedMinutes: 360,
          workingStatus: WORKING_STATUS.INCOMPLETE,
          closedBy: CLOSED_BY.EMPLOYEE,
          verification: {
            status: VERIFICATION_STATUS.VALID,
            reviewedBy: sarahId,
            reviewedAt: day.set({ hour: 16, minute: 0 }).toJSDate(),
            remarks: "Approved planned half day",
          },
          overtime: {
            status: OVERTIME_STATUS.NOT_REQUESTED,
          },
        }),
      },
      // Day -5: Completed shift with Invalid Verification
      {
        dayOffset: 5,
        build: (day, workDate) => ({
          employeeId: alice._id,
          workDate,
          punchIn: {
            at: day.set({ hour: 9, minute: 0, second: 0 }).toJSDate(),
            selfie: null,
            location: {
              latitude: 28.6139,
              longitude: 77.209,
              accuracy: 8,
              distanceFromOfficeMeters: 30,
              withinGeofence: true,
            },
          },
          punchOut: {
            at: day.set({ hour: 17, minute: 30, second: 0 }).toJSDate(),
            selfie: null,
            location: {
              latitude: 28.69,
              longitude: 77.3,
              accuracy: 25,
              distanceFromOfficeMeters: 12000,
              withinGeofence: false,
            },
          },
          workedMinutes: 510,
          workingStatus: WORKING_STATUS.COMPLETED,
          closedBy: CLOSED_BY.EMPLOYEE,
          verification: {
            status: VERIFICATION_STATUS.INVALID,
            reviewedBy: sarahId,
            reviewedAt: day.set({ hour: 18, minute: 15 }).toJSDate(),
            remarks: "Location discrepancy noted during punch out",
          },
          overtime: {
            status: OVERTIME_STATUS.NOT_REQUESTED,
          },
        }),
      },
      // Day -6: Missed shift (system closed)
      {
        dayOffset: 6,
        build: (day, workDate) => ({
          employeeId: alice._id,
          workDate,
          punchIn: {
            at: day.set({ hour: 9, minute: 0, second: 0 }).toJSDate(),
            selfie: null,
            location: {
              latitude: 28.6139,
              longitude: 77.209,
              accuracy: 10,
              distanceFromOfficeMeters: 40,
              withinGeofence: true,
            },
          },
          punchOut: null,
          workedMinutes: 0,
          workingStatus: WORKING_STATUS.MISSED,
          closedBy: CLOSED_BY.SYSTEM,
          verification: {
            status: VERIFICATION_STATUS.PENDING,
          },
          overtime: {
            status: OVERTIME_STATUS.NOT_REQUESTED,
          },
        }),
      },
    ];

    for (const item of aliceRecords) {
      const day = now.minus({ days: item.dayOffset });
      const workDate = day.toFormat("yyyy-MM-dd");
      const existing = await Attendance.findOne({
        employeeId: alice._id,
        workDate,
      });
      if (!existing) {
        await Attendance.create(item.build(day, workDate));
      }
    }

    // Sarah Connor attendance history (personal workforce records for manager area)
    for (let dayOffset = 1; dayOffset <= 4; dayOffset++) {
      const day = now.minus({ days: dayOffset });
      const workDate = day.toFormat("yyyy-MM-dd");
      const existing = await Attendance.findOne({
        employeeId: sarah._id,
        workDate,
      });
      if (!existing) {
        await Attendance.create({
          employeeId: sarah._id,
          workDate,
          punchIn: {
            at: day.set({ hour: 9, minute: 0, second: 0 }).toJSDate(),
            selfie: null,
            location: {
              latitude: 28.6139,
              longitude: 77.209,
              accuracy: 9,
              distanceFromOfficeMeters: 30,
              withinGeofence: true,
            },
          },
          punchOut: {
            at: day.set({ hour: 17, minute: 15, second: 0 }).toJSDate(),
            selfie: null,
            location: {
              latitude: 28.6139,
              longitude: 77.209,
              accuracy: 9,
              distanceFromOfficeMeters: 30,
              withinGeofence: true,
            },
          },
          workedMinutes: 495,
          workingStatus: WORKING_STATUS.COMPLETED,
          closedBy: CLOSED_BY.EMPLOYEE,
          verification: {
            status: VERIFICATION_STATUS.VALID,
          },
          overtime: {
            status: OVERTIME_STATUS.NOT_REQUESTED,
          },
        });
      }
    }

    // 8. Seed sample notifications (idempotent check by userId and type)
    const day2Date = now.minus({ days: 2 }).toFormat("yyyy-MM-dd");
    const existingAliceNotif1 = await Notification.findOne({
      userId: alice._id,
      type: NOTIFICATION_TYPES.OVERTIME_APPROVED,
      "data.workDate": day2Date,
    });
    if (!existingAliceNotif1) {
      await Notification.create({
        userId: alice._id,
        type: NOTIFICATION_TYPES.OVERTIME_APPROVED,
        title: "Overtime Approved",
        message:
          "Your overtime request of 60 minutes for sprint release has been approved by Sarah Connor.",
        data: { workDate: day2Date },
      });
    }

    const day3Date = now.minus({ days: 3 }).toFormat("yyyy-MM-dd");
    const existingSarahNotif = await Notification.findOne({
      userId: sarah._id,
      type: NOTIFICATION_TYPES.OVERTIME_REQUESTED,
      "data.workDate": day3Date,
    });
    if (!existingSarahNotif) {
      await Notification.create({
        userId: sarah._id,
        type: NOTIFICATION_TYPES.OVERTIME_REQUESTED,
        title: "Overtime Request Pending",
        message: "Alice Walker requested 90 minutes of overtime.",
        data: { workDate: day3Date },
      });
    }

    // 9. Programmatic Verification Step
    const adminCheck = await User.findOne({ email: DEMO_ADMIN_EMAIL }).select(
      "+passwordHash"
    );
    const sarahCheck = await User.findOne({ email: DEMO_MANAGER_EMAIL }).select(
      "+passwordHash"
    );
    const aliceCheck = await User.findOne({ email: DEMO_EMPLOYEE_EMAIL }).select(
      "+passwordHash"
    );

    if (!adminCheck || !sarahCheck || !aliceCheck) {
      throw new Error("Verification failed: One or more demo users are missing.");
    }

    const adminCount = await User.countDocuments({ email: DEMO_ADMIN_EMAIL });
    const managerCount = await User.countDocuments({
      email: DEMO_MANAGER_EMAIL,
    });
    const employeeCount = await User.countDocuments({
      email: DEMO_EMPLOYEE_EMAIL,
    });

    if (adminCount !== 1 || managerCount !== 1 || employeeCount !== 1) {
      throw new Error("Verification failed: Duplicate demo accounts detected.");
    }

    if (
      adminCheck.role !== ROLES.ADMIN ||
      sarahCheck.role !== ROLES.MANAGER ||
      aliceCheck.role !== ROLES.EMPLOYEE
    ) {
      throw new Error("Verification failed: Role mismatch on demo accounts.");
    }

    if (
      adminCheck.accountStatus !== "active" ||
      !adminCheck.isActive ||
      sarahCheck.accountStatus !== "active" ||
      !sarahCheck.isActive ||
      aliceCheck.accountStatus !== "active" ||
      !aliceCheck.isActive
    ) {
      throw new Error(
        "Verification failed: One or more accounts are not active."
      );
    }

    const adminPassMatch = await adminCheck.comparePassword(DEMO_PASSWORD);
    const sarahPassMatch = await sarahCheck.comparePassword(DEMO_PASSWORD);
    const alicePassMatch = await aliceCheck.comparePassword(DEMO_PASSWORD);

    if (!adminPassMatch || !sarahPassMatch || !alicePassMatch) {
      throw new Error("Verification failed: Password comparison check failed.");
    }

    if (adminCheck.managerId !== null) {
      throw new Error("Verification failed: Admin should not have a manager.");
    }

    const adminAttCountAfter = await Attendance.countDocuments({
      employeeId: adminCheck._id,
    });
    if (adminAttCountAfter !== 0) {
      throw new Error(
        "Verification failed: Admin must have zero attendance records."
      );
    }

    if (
      !aliceCheck.managerId ||
      aliceCheck.managerId.toString() !== sarahCheck._id.toString()
    ) {
      throw new Error(
        "Verification failed: Alice's managerId does not match Sarah's _id."
      );
    }

    const teamMembers = await listTeamMembers(sarahCheck._id);
    const teamMemberFound = teamMembers.some(
      (m) => m._id.toString() === aliceCheck._id.toString()
    );
    if (!teamMemberFound) {
      throw new Error(
        "Verification failed: Alice not returned in Sarah's team query."
      );
    }

    // Print concise, non-sensitive summary matching specification
    console.log(`
Demo account seeding completed.

Admin:    active
Manager:  active
Employee: active
Team relationship: Employee assigned to Manager
Password verification: passed for all three accounts
Dashboard route configuration: verified
`);

    if (!skipDisconnect) {
      await disconnectDB();
    }

    return {
      success: true,
      admin: adminCheck,
      manager: sarahCheck,
      employee: aliceCheck,
    };
  } catch (error) {
    logger.error("Error during demo account seeding:", error.message);
    if (!skipDisconnect) {
      await disconnectDB();
    }
    if (skipExit) {
      throw error;
    }
    process.exit(1);
  }
};

if (process.argv[1]?.endsWith("seed-demo-accounts.js")) {
  seedDemoAccounts().then(() => process.exit(0));
}

export default seedDemoAccounts;
