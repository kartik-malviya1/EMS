import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { User } from '../models/user.model.js';
import { Attendance } from '../models/attendance.model.js';
import {
  ROLES,
  WORKING_STATUS,
  VERIFICATION_STATUS,
  OVERTIME_STATUS,
  CLOSED_BY,
} from '../config/constants.js';
import { getWorkDate, nowInBusinessTime } from '../utils/time.js';

describe('Reports & Dashboard Endpoints (Phase 5)', () => {
  let _admin;
  let manager1;
  let manager2;
  let employee1UnderM1;
  let employee2UnderM2;

  let adminCookie;
  let mgr1Cookie;
  let mgr2Cookie;
  let emp1Cookie;
  let _emp2Cookie;

  const today = getWorkDate();

  beforeEach(async () => {
    const passwordHash = await User.hashPassword('Password123');

    _admin = await User.create({
      name: 'Admin Boss',
      email: 'admin.rep@example.com',
      passwordHash,
      role: ROLES.ADMIN,
      isActive: true,
    });

    manager1 = await User.create({
      name: 'Manager Mike',
      email: 'manager1.rep@example.com',
      passwordHash,
      role: ROLES.MANAGER,
      isActive: true,
    });

    manager2 = await User.create({
      name: 'Manager Dave',
      email: 'manager2.rep@example.com',
      passwordHash,
      role: ROLES.MANAGER,
      isActive: true,
    });

    employee1UnderM1 = await User.create({
      name: 'Alice Under M1',
      email: 'alice.rep@example.com',
      passwordHash,
      role: ROLES.EMPLOYEE,
      managerId: manager1._id,
      isActive: true,
    });

    employee2UnderM2 = await User.create({
      name: 'Bob Under M2',
      email: 'bob.rep@example.com',
      passwordHash,
      role: ROLES.EMPLOYEE,
      managerId: manager2._id,
      isActive: true,
    });

    // Login cookies
    const loginA = await request(app).post('/api/auth/login').send({
      email: 'admin.rep@example.com',
      password: 'Password123',
    });
    adminCookie = loginA.headers['set-cookie'];

    const loginM1 = await request(app).post('/api/auth/login').send({
      email: 'manager1.rep@example.com',
      password: 'Password123',
    });
    mgr1Cookie = loginM1.headers['set-cookie'];

    const loginM2 = await request(app).post('/api/auth/login').send({
      email: 'manager2.rep@example.com',
      password: 'Password123',
    });
    mgr2Cookie = loginM2.headers['set-cookie'];

    const loginE1 = await request(app).post('/api/auth/login').send({
      email: 'alice.rep@example.com',
      password: 'Password123',
    });
    emp1Cookie = loginE1.headers['set-cookie'];

    const loginE2 = await request(app).post('/api/auth/login').send({
      email: 'bob.rep@example.com',
      password: 'Password123',
    });
    _emp2Cookie = loginE2.headers['set-cookie'];

    // Seed test attendance data:
    // 1. Alice (under Manager 1): Today completed (540m = 9h), overtime pending, valid verification
    await Attendance.create({
      employeeId: employee1UnderM1._id,
      workDate: today,
      punchIn: {
        at: new Date(`${today}T09:00:00Z`),
        selfie: { publicId: 'selfie-1', mimeType: 'image/jpeg', bytes: 1024 },
        location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
      },
      punchOut: {
        at: new Date(`${today}T18:00:00Z`),
        selfie: { publicId: 'selfie-2', mimeType: 'image/jpeg', bytes: 1024 },
        location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
      },
      workedMinutes: 540,
      workingStatus: WORKING_STATUS.COMPLETED,
      closedBy: CLOSED_BY.EMPLOYEE,
      verification: {
        status: VERIFICATION_STATUS.VALID,
        reviewedBy: manager1._id,
        reviewedAt: new Date(),
        remarks: 'All good',
      },
      overtime: {
        status: OVERTIME_STATUS.PENDING,
        requestedMinutes: 60,
        reason: 'Late deployment',
        requestedAt: new Date(),
      },
    });

    // 2. Alice: 2 days ago incomplete (360m = 6h), invalid verification
    const twoDaysAgo = nowInBusinessTime().minus({ days: 2 }).toFormat('yyyy-MM-dd');
    await Attendance.create({
      employeeId: employee1UnderM1._id,
      workDate: twoDaysAgo,
      punchIn: {
        at: new Date(`${twoDaysAgo}T09:00:00Z`),
        selfie: null,
        location: { latitude: 28.6139, longitude: 77.209, accuracy: 12 },
      },
      punchOut: {
        at: new Date(`${twoDaysAgo}T15:00:00Z`),
        selfie: null,
        location: { latitude: 28.6139, longitude: 77.209, accuracy: 12 },
      },
      workedMinutes: 360,
      workingStatus: WORKING_STATUS.INCOMPLETE,
      closedBy: CLOSED_BY.EMPLOYEE,
      verification: {
        status: VERIFICATION_STATUS.INVALID,
        reviewedBy: manager1._id,
        reviewedAt: new Date(),
        remarks: 'Location failed',
      },
    });

    // 3. Bob (under Manager 2): Today completed (480m = 8h), approved overtime 30m, pending verification
    await Attendance.create({
      employeeId: employee2UnderM2._id,
      workDate: today,
      punchIn: {
        at: new Date(`${today}T09:00:00Z`),
        selfie: null,
        location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
      },
      punchOut: {
        at: new Date(`${today}T17:00:00Z`),
        selfie: null,
        location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
      },
      workedMinutes: 480,
      workingStatus: WORKING_STATUS.COMPLETED,
      closedBy: CLOSED_BY.EMPLOYEE,
      verification: {
        status: VERIFICATION_STATUS.PENDING,
      },
      overtime: {
        status: OVERTIME_STATUS.APPROVED,
        requestedMinutes: 30,
        reason: 'Maintenance',
        requestedAt: new Date(),
      },
    });
  });

  describe('GET /api/reports/daily', () => {
    it('scopes report rows and summary correctly for Employee', async () => {
      const res = await request(app)
        .get('/api/reports/daily')
        .set('Cookie', emp1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      // Alice has 2 records
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);

      // Check required fields format
      const row = res.body.data[0];
      expect(row).toHaveProperty('attendanceId');
      expect(row).toHaveProperty('employeeName', 'Alice Under M1');
      expect(row).toHaveProperty('employeeEmail', 'alice.rep@example.com');
      expect(row).toHaveProperty('workDate');
      expect(row).toHaveProperty('punchInAt');
      expect(row).toHaveProperty('punchOutAt');
      expect(row).toHaveProperty('punchInLocation');
      expect(row).toHaveProperty('punchOutLocation');
      expect(row).toHaveProperty('workedMinutes');
      expect(row).toHaveProperty('workedHours');
      expect(row).toHaveProperty('workingStatus');
      expect(row).toHaveProperty('verificationStatus');
      expect(row).toHaveProperty('overtimeStatus');
      expect(row).toHaveProperty('hasPunchInSelfie');
      expect(row).toHaveProperty('hasPunchOutSelfie');

      // Summary counts scoped to Alice
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.workingStatus.completed).toBe(1);
      expect(res.body.summary.workingStatus.incomplete).toBe(1);
      expect(res.body.summary.verificationStatus.valid).toBe(1);
      expect(res.body.summary.verificationStatus.invalid).toBe(1);
      expect(res.body.summary.overtimeStatus.pending).toBe(1);
    });

    it('scopes report correctly for Manager (only team members)', async () => {
      const res = await request(app)
        .get('/api/reports/daily')
        .set('Cookie', mgr1Cookie);

      expect(res.status).toBe(200);
      // Manager 1 only has Alice (2 records)
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
      res.body.data.forEach((r) => expect(r.employeeEmail).toBe('alice.rep@example.com'));

      // Manager 2 only has Bob (1 record)
      const res2 = await request(app)
        .get('/api/reports/daily')
        .set('Cookie', mgr2Cookie);

      expect(res2.status).toBe(200);
      expect(res2.body.data).toHaveLength(1);
      expect(res2.body.data[0].employeeEmail).toBe('bob.rep@example.com');
    });

    it('allows Admin to see all rows across the company', async () => {
      const res = await request(app)
        .get('/api/reports/daily')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      // Total 3 records across all users
      expect(res.body.data).toHaveLength(3);
      expect(res.body.meta.total).toBe(3);
      expect(res.body.summary.workingStatus.completed).toBe(2);
      expect(res.body.summary.workingStatus.incomplete).toBe(1);
    });

    it('filters rows by specific date', async () => {
      const res = await request(app)
        .get(`/api/reports/daily?date=${today}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      // 2 records today (Alice + Bob)
      expect(res.body.data).toHaveLength(2);
      res.body.data.forEach((r) => expect(r.workDate).toBe(today));
    });

    it('filters rows by from and to range', async () => {
      const threeDaysAgo = nowInBusinessTime().minus({ days: 3 }).toFormat('yyyy-MM-dd');
      const yesterday = nowInBusinessTime().minus({ days: 1 }).toFormat('yyyy-MM-dd');

      const res = await request(app)
        .get(`/api/reports/daily?from=${threeDaysAgo}&to=${yesterday}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      // Only Alice's 2-day-old record falls in this range
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/reports/daily/export', () => {
    it('exports XLSX report with correct headers and content type', async () => {
      const res = await request(app)
        .get('/api/reports/daily/export?format=xlsx')
        .set('Cookie', adminCookie)
        .buffer(true)
        .parse((r, cb) => {
          const chunks = [];
          r.on('data', (c) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.headers['content-disposition']).toContain('attachment; filename="attendance-report.xlsx"');
      expect(res.body).toBeInstanceOf(Buffer);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('exports PDF report with landscape layout and correct content type', async () => {
      const res = await request(app)
        .get('/api/reports/daily/export?format=pdf')
        .set('Cookie', mgr1Cookie);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment; filename="attendance-report.pdf"');
      expect(res.body).toBeInstanceOf(Buffer);
      // PDF header magic bytes '%PDF'
      expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
    });
  });

  describe('GET /api/dashboard/summary', () => {
    it('returns exact dashboard metrics for Employee', async () => {
      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Cookie', emp1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const d = res.body.data;
      // Alice: 1 completed, 1 incomplete, 0 missed
      expect(d.completedDays).toBe(1);
      expect(d.incompleteDays).toBe(1);
      expect(d.missedDays).toBe(0);
      // Worked minutes: 540 + 360 = 900
      expect(d.totalWorkedMinutes).toBe(900);
      // Overtime: 1 pending, 0 approved
      expect(d.pendingOvertime).toBe(1);
      expect(d.approvedOvertimeMinutes).toBe(0);
      // Invalid days: 1
      expect(d.invalidDays).toBe(1);
    });

    it('returns exact dashboard metrics for Manager', async () => {
      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Cookie', mgr1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const d = res.body.data;
      // Manager 1 has 1 team member (Alice)
      expect(d.teamSize).toBe(1);
      expect(d.punchedIn).toBe(1);
      expect(d.notYetPunchedIn).toBe(0);
      expect(d.completed).toBe(1);
      expect(d.incomplete).toBe(0);
      // Alice's today verification is valid, older is invalid -> 0 pending
      expect(d.pendingVerification).toBe(0);
      // Alice's today overtime is pending
      expect(d.pendingOvertime).toBe(1);
    });

    it('returns exact dashboard metrics for Admin', async () => {
      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const d = res.body.data;
      // Users: 1 admin, 2 managers, 2 employees = 5 active
      expect(d.totalUsers.admin).toBe(1);
      expect(d.totalUsers.manager).toBe(2);
      expect(d.totalUsers.employee).toBe(2);
      expect(d.activeUsers).toBe(5);

      // Today system-wide: 2 punched in (Alice, Bob), 2 completed, 0 incomplete, 0 missed
      expect(d.today.punchedIn).toBe(2);
      expect(d.today.completed).toBe(2);
      expect(d.today.incomplete).toBe(0);
      expect(d.today.missed).toBe(0);
      // Pending verification today: Bob is pending!
      expect(d.today.pendingVerification).toBe(1);
      // Pending overtime: Alice is pending!
      expect(d.today.pendingOvertime).toBe(1);
    });
  });
});
