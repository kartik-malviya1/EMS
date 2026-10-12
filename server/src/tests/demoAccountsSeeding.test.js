import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app.js";
import { User } from "../models/user.model.js";
import { Attendance } from "../models/attendance.model.js";
import {
  seedDemoAccounts,
  DEMO_ADMIN_EMAIL,
  DEMO_MANAGER_EMAIL,
  DEMO_EMPLOYEE_EMAIL,
  DEMO_PASSWORD,
} from "../scripts/seed-demo-accounts.js";
import { ROLES, ACCOUNT_STATUS } from "../config/constants.js";

describe("AMS Demo Accounts Seeding and Dashboard Verification", () => {
  beforeEach(async () => {
    // Start with a clean state for demo accounts
    await User.deleteMany({
      email: {
        $in: [DEMO_ADMIN_EMAIL, DEMO_MANAGER_EMAIL, DEMO_EMPLOYEE_EMAIL],
      },
    });
  });

  it("1. Seeds Admin, Manager, and Employee with valid hashes and active statuses", async () => {
    const result = await seedDemoAccounts({
      skipDisconnect: true,
      skipExit: true,
    });
    expect(result.success).toBe(true);

    const admin = await User.findOne({ email: DEMO_ADMIN_EMAIL }).select(
      "+passwordHash"
    );
    const manager = await User.findOne({ email: DEMO_MANAGER_EMAIL }).select(
      "+passwordHash"
    );
    const employee = await User.findOne({ email: DEMO_EMPLOYEE_EMAIL }).select(
      "+passwordHash"
    );

    expect(admin).toBeTruthy();
    expect(admin.role).toBe(ROLES.ADMIN);
    expect(admin.accountStatus).toBe(ACCOUNT_STATUS.ACTIVE);
    expect(admin.isActive).toBe(true);
    expect(admin.managerId).toBeNull();
    expect(admin.passwordHash).not.toBe(DEMO_PASSWORD);
    expect(await admin.comparePassword(DEMO_PASSWORD)).toBe(true);

    expect(manager).toBeTruthy();
    expect(manager.name).toBe("Sarah Connor (Engineering Mgr)");
    expect(manager.role).toBe(ROLES.MANAGER);
    expect(manager.accountStatus).toBe(ACCOUNT_STATUS.ACTIVE);
    expect(manager.isActive).toBe(true);
    expect(manager.managerId).toBeNull();
    expect(manager.department).toBe("Engineering");
    expect(manager.designation).toBe("Engineering Manager");
    expect(manager.employeeId).toBe("DEMO-MGR-001");
    expect(manager.passwordHash).not.toBe(DEMO_PASSWORD);
    expect(await manager.comparePassword(DEMO_PASSWORD)).toBe(true);

    expect(employee).toBeTruthy();
    expect(employee.name).toBe("Alice Walker (Engineering)");
    expect(employee.role).toBe(ROLES.EMPLOYEE);
    expect(employee.accountStatus).toBe(ACCOUNT_STATUS.ACTIVE);
    expect(employee.isActive).toBe(true);
    expect(employee.managerId.toString()).toBe(manager._id.toString());
    expect(employee.department).toBe("Engineering");
    expect(employee.designation).toBe("Software Engineer");
    expect(employee.employeeId).toBe("DEMO-EMP-001");
    expect(employee.passwordHash).not.toBe(DEMO_PASSWORD);
    expect(await employee.comparePassword(DEMO_PASSWORD)).toBe(true);
  });

  it("2. Real login authentication: all three accounts can sign in and call /api/auth/me", async () => {
    await seedDemoAccounts({ skipDisconnect: true, skipExit: true });

    // Admin login
    const adminLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: DEMO_ADMIN_EMAIL, password: DEMO_PASSWORD });
    expect(adminLoginRes.status).toBe(200);
    expect(adminLoginRes.body.data.role).toBe("admin");
    const adminCookie = adminLoginRes.headers["set-cookie"];
    expect(adminCookie).toBeDefined();

    const adminMeRes = await request(app)
      .get("/api/auth/me")
      .set("Cookie", adminCookie);
    expect(adminMeRes.status).toBe(200);
    expect(adminMeRes.body.data.email).toBe(DEMO_ADMIN_EMAIL);
    expect(adminMeRes.body.data.role).toBe("admin");

    // Manager login
    const managerLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: DEMO_MANAGER_EMAIL, password: DEMO_PASSWORD });
    expect(managerLoginRes.status).toBe(200);
    expect(managerLoginRes.body.data.role).toBe("manager");
    const managerCookie = managerLoginRes.headers["set-cookie"];
    expect(managerCookie).toBeDefined();

    const managerMeRes = await request(app)
      .get("/api/auth/me")
      .set("Cookie", managerCookie);
    expect(managerMeRes.status).toBe(200);
    expect(managerMeRes.body.data.email).toBe(DEMO_MANAGER_EMAIL);
    expect(managerMeRes.body.data.role).toBe("manager");

    // Employee login
    const employeeLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: DEMO_EMPLOYEE_EMAIL, password: DEMO_PASSWORD });
    expect(employeeLoginRes.status).toBe(200);
    expect(employeeLoginRes.body.data.role).toBe("employee");
    const employeeCookie = employeeLoginRes.headers["set-cookie"];
    expect(employeeCookie).toBeDefined();

    const employeeMeRes = await request(app)
      .get("/api/auth/me")
      .set("Cookie", employeeCookie);
    expect(employeeMeRes.status).toBe(200);
    expect(employeeMeRes.body.data.email).toBe(DEMO_EMPLOYEE_EMAIL);
    expect(employeeMeRes.body.data.role).toBe("employee");
  });

  it("3. Manager team discovery: Sarah discovers Alice via GET /api/users/team", async () => {
    await seedDemoAccounts({ skipDisconnect: true, skipExit: true });

    const managerLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: DEMO_MANAGER_EMAIL, password: DEMO_PASSWORD });
    const managerCookie = managerLoginRes.headers["set-cookie"];

    const teamRes = await request(app)
      .get("/api/users/team")
      .set("Cookie", managerCookie);
    expect(teamRes.status).toBe(200);
    expect(Array.isArray(teamRes.body.data)).toBe(true);

    const aliceFound = teamRes.body.data.find(
      (m) => m.email === DEMO_EMPLOYEE_EMAIL
    );
    expect(aliceFound).toBeDefined();
    expect(aliceFound.name).toBe("Alice Walker (Engineering)");
  });

  it("4. Admin restrictions: Admin has zero seeded attendance records and punch endpoints reject admin", async () => {
    await seedDemoAccounts({ skipDisconnect: true, skipExit: true });

    const admin = await User.findOne({ email: DEMO_ADMIN_EMAIL });
    const attendanceCount = await Attendance.countDocuments({
      employeeId: admin._id,
    });
    expect(attendanceCount).toBe(0);

    const adminLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: DEMO_ADMIN_EMAIL, password: DEMO_PASSWORD });
    const adminCookie = adminLoginRes.headers["set-cookie"];

    const punchRes = await request(app)
      .post("/api/attendance/punch-in")
      .set("Cookie", adminCookie)
      .send({
        location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
      });
    expect(punchRes.status).toBe(403);
    expect(punchRes.body.error.code).toBe("ADMIN_NOT_ELIGIBLE");
  });

  it("5. Idempotency: running the seed multiple times preserves IDs and does not duplicate users or attendance", async () => {
    await seedDemoAccounts({ skipDisconnect: true, skipExit: true });

    const firstAdmin = await User.findOne({ email: DEMO_ADMIN_EMAIL });
    const firstManager = await User.findOne({ email: DEMO_MANAGER_EMAIL });
    const firstEmployee = await User.findOne({ email: DEMO_EMPLOYEE_EMAIL });

    const firstAliceAttendanceCount = await Attendance.countDocuments({
      employeeId: firstEmployee._id,
    });
    expect(firstAliceAttendanceCount).toBeGreaterThan(0);

    // Run seeder a second time
    await seedDemoAccounts({ skipDisconnect: true, skipExit: true });

    const secondAdmin = await User.findOne({ email: DEMO_ADMIN_EMAIL });
    const secondManager = await User.findOne({ email: DEMO_MANAGER_EMAIL });
    const secondEmployee = await User.findOne({ email: DEMO_EMPLOYEE_EMAIL });

    // Ensure _ids are preserved (not dropped & recreated)
    expect(secondAdmin._id.toString()).toBe(firstAdmin._id.toString());
    expect(secondManager._id.toString()).toBe(firstManager._id.toString());
    expect(secondEmployee._id.toString()).toBe(firstEmployee._id.toString());

    // Ensure user count did not multiply
    const adminCount = await User.countDocuments({ email: DEMO_ADMIN_EMAIL });
    const managerCount = await User.countDocuments({
      email: DEMO_MANAGER_EMAIL,
    });
    const employeeCount = await User.countDocuments({
      email: DEMO_EMPLOYEE_EMAIL,
    });

    expect(adminCount).toBe(1);
    expect(managerCount).toBe(1);
    expect(employeeCount).toBe(1);

    // Ensure attendance count did not duplicate
    const secondAliceAttendanceCount = await Attendance.countDocuments({
      employeeId: secondEmployee._id,
    });
    expect(secondAliceAttendanceCount).toBe(firstAliceAttendanceCount);
  });

  it("6. Production safety protection: refuses execution when NODE_ENV=production", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      await expect(
        seedDemoAccounts({ skipDisconnect: true, skipExit: true })
      ).rejects.toThrow(/Production execution blocked/);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
