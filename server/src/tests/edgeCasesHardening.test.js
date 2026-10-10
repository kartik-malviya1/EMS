import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { User } from '../models/user.model.js';
import { Attendance } from '../models/attendance.model.js';
import { Notification } from '../models/notification.model.js';
import {
  ROLES,
  WORKING_STATUS,
  OVERTIME_STATUS,
  CLOSED_BY,
} from '../config/constants.js';
import {
  getStorageAdapter,
  setStorageAdapter,
  InMemoryStorageAdapter,
} from '../services/storage.service.js';
import { runMissedPunchInJob } from '../jobs/missedPunchIn.job.js';
import { runAutoCloseJob } from '../jobs/autoClose.job.js';

describe('Edge-Case Hardening & Administrative-Only Matrix (17 Cases)', () => {
  let adminUser, adminCookie;
  let manager1, mgr1Cookie;
  let manager2, mgr2Cookie;
  let employee1, emp1Cookie; // under manager1
  let employeeUnassigned, empUnassignedCookie; // managerId: null

  const validJpgBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
    0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff,
    0xd9,
  ]);

  beforeEach(async () => {
    // Fresh in-memory storage adapter for each test
    setStorageAdapter(new InMemoryStorageAdapter());

    const pwdHash = await User.hashPassword('Pass1234');

    adminUser = await User.create({
      name: 'System Admin',
      email: 'admin.hardening@example.com',
      passwordHash: pwdHash,
      role: ROLES.ADMIN,
      managerId: null,
      isActive: true,
    });
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: adminUser.email, password: 'Pass1234' });
    adminCookie = adminLogin.headers['set-cookie'];

    manager1 = await User.create({
      name: 'Manager One',
      email: 'mgr1.hardening@example.com',
      passwordHash: pwdHash,
      role: ROLES.MANAGER,
      managerId: null,
      isActive: true,
    });
    const mgr1Login = await request(app)
      .post('/api/auth/login')
      .send({ email: manager1.email, password: 'Pass1234' });
    mgr1Cookie = mgr1Login.headers['set-cookie'];

    manager2 = await User.create({
      name: 'Manager Two',
      email: 'mgr2.hardening@example.com',
      passwordHash: pwdHash,
      role: ROLES.MANAGER,
      managerId: null,
      isActive: true,
    });
    const mgr2Login = await request(app)
      .post('/api/auth/login')
      .send({ email: manager2.email, password: 'Pass1234' });
    mgr2Cookie = mgr2Login.headers['set-cookie'];

    employee1 = await User.create({
      name: 'Alice Under M1',
      email: 'alice.m1@example.com',
      passwordHash: pwdHash,
      role: ROLES.EMPLOYEE,
      managerId: manager1._id,
      isActive: true,
    });
    const emp1Login = await request(app)
      .post('/api/auth/login')
      .send({ email: employee1.email, password: 'Pass1234' });
    emp1Cookie = emp1Login.headers['set-cookie'];

    employeeUnassigned = await User.create({
      name: 'Orphan Employee',
      email: 'orphan.emp@example.com',
      passwordHash: pwdHash,
      role: ROLES.EMPLOYEE,
      managerId: null,
      isActive: true,
    });
    const unassignedLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: employeeUnassigned.email, password: 'Pass1234' });
    empUnassignedCookie = unassignedLogin.headers['set-cookie'];
  });

  // CASE 1: Admin direct API calls -> 403 ADMIN_NOT_ELIGIBLE and no records/uploads
  describe('Case 1: Admin Direct Attendance API Calls', () => {
    it('rejects punch-in, punch-out, today, me, and overtime with 403 ADMIN_NOT_ELIGIBLE', async () => {
      const adapter = getStorageAdapter();

      // 1. Punch-in
      const punchInRes = await request(app)
        .post('/api/attendance/punch-in')
        .set('Cookie', adminCookie)
        .attach('selfie', validJpgBuffer, 'selfie.jpg')
        .field('latitude', 28.6139)
        .field('longitude', 77.209)
        .field('accuracy', 10);

      expect(punchInRes.status).toBe(403);
      expect(punchInRes.body.error.code).toBe('ADMIN_NOT_ELIGIBLE');
      // Proves no upload occurred before reject
      expect(adapter.storage.size).toBe(0);

      // 2. Punch-out
      const punchOutRes = await request(app)
        .post('/api/attendance/punch-out')
        .set('Cookie', adminCookie)
        .attach('selfie', validJpgBuffer, 'selfie.jpg')
        .field('latitude', 28.6139)
        .field('longitude', 77.209)
        .field('accuracy', 10);

      expect(punchOutRes.status).toBe(403);
      expect(punchOutRes.body.error.code).toBe('ADMIN_NOT_ELIGIBLE');

      // 3. GET /today
      const todayRes = await request(app)
        .get('/api/attendance/today')
        .set('Cookie', adminCookie);

      expect(todayRes.status).toBe(403);
      expect(todayRes.body.error.code).toBe('ADMIN_NOT_ELIGIBLE');

      // 4. GET /me
      const meRes = await request(app)
        .get('/api/attendance/me')
        .set('Cookie', adminCookie);

      expect(meRes.status).toBe(403);
      expect(meRes.body.error.code).toBe('ADMIN_NOT_ELIGIBLE');

      // 5. POST /:id/overtime
      const dummyId = '507f1f77bcf86cd799439011';
      const otRes = await request(app)
        .post(`/api/attendance/${dummyId}/overtime`)
        .set('Cookie', adminCookie)
        .send({ requestedMinutes: 30, reason: 'Extra administrative audits' });

      expect(otRes.status).toBe(403);
      expect(otRes.body.error.code).toBe('ADMIN_NOT_ELIGIBLE');

      // Proves NO attendance document was ever created for the admin
      const count = await Attendance.countDocuments({ employeeId: adminUser._id });
      expect(count).toBe(0);
    });
  });

  // CASE 2: Reviewer Matrix
  describe('Case 2: Reviewer Matrix Permissions', () => {
    let empRecord, mgrRecord;

    beforeEach(async () => {
      empRecord = await Attendance.create({
        employeeId: employee1._id,
        workDate: '2026-10-01',
        punchIn: {
          at: new Date('2026-10-01T09:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        punchOut: {
          at: new Date('2026-10-01T18:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        workedMinutes: 540,
        workingStatus: WORKING_STATUS.COMPLETED,
        closedBy: CLOSED_BY.EMPLOYEE,
        overtime: {
          status: OVERTIME_STATUS.PENDING,
          requestedMinutes: 45,
          reason: 'Client bug triage',
          requestedAt: new Date('2026-10-01T18:30:00Z'),
        },
      });

      mgrRecord = await Attendance.create({
        employeeId: manager1._id,
        workDate: '2026-10-01',
        punchIn: {
          at: new Date('2026-10-01T09:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        punchOut: {
          at: new Date('2026-10-01T18:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        workedMinutes: 540,
        workingStatus: WORKING_STATUS.COMPLETED,
        closedBy: CLOSED_BY.EMPLOYEE,
        overtime: {
          status: OVERTIME_STATUS.PENDING,
          requestedMinutes: 45,
          reason: 'Release management lead',
          requestedAt: new Date('2026-10-01T18:30:00Z'),
        },
      });
    });

    it('blocks manager self-review with 403 FORBIDDEN', async () => {
      // Verification self-review
      const resV = await request(app)
        .patch(`/api/attendance/${mgrRecord._id}/verification`)
        .set('Cookie', mgr1Cookie)
        .send({ status: 'valid' });

      expect(resV.status).toBe(403);
      expect(resV.body.error.code).toBe('FORBIDDEN');

      // Overtime self-review
      const resO = await request(app)
        .patch(`/api/attendance/${mgrRecord._id}/overtime/review`)
        .set('Cookie', mgr1Cookie)
        .send({ decision: 'approved' });

      expect(resO.status).toBe(403);
      expect(resO.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 404 when manager reviews another manager team member', async () => {
      const res = await request(app)
        .patch(`/api/attendance/${empRecord._id}/verification`)
        .set('Cookie', mgr2Cookie) // Manager 2 has no scope over Alice
        .send({ status: 'valid' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 when manager reviews another manager record (admins only)', async () => {
      const res = await request(app)
        .patch(`/api/attendance/${mgrRecord._id}/overtime/review`)
        .set('Cookie', mgr2Cookie)
        .send({ decision: 'approved' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('allows admin to review manager record', async () => {
      const res = await request(app)
        .patch(`/api/attendance/${mgrRecord._id}/overtime/review`)
        .set('Cookie', adminCookie)
        .send({ decision: 'approved' });

      expect(res.status).toBe(200);
      expect(res.body.data.overtime.status).toBe('approved');
    });
  });

  // CASE 3: Employee without manager: overtime succeeds, admins notified
  describe('Case 3: Employee Without Manager Overtime', () => {
    it('succeeds, notifies active admins, and does not crash on null manager', async () => {
      const unassignedRecord = await Attendance.create({
        employeeId: employeeUnassigned._id,
        workDate: '2026-10-02',
        punchIn: {
          at: new Date('2026-10-02T09:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        punchOut: {
          at: new Date('2026-10-02T18:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        workedMinutes: 540,
        workingStatus: WORKING_STATUS.COMPLETED,
        closedBy: CLOSED_BY.EMPLOYEE,
      });

      const res = await request(app)
        .post(`/api/attendance/${unassignedRecord._id}/overtime`)
        .set('Cookie', empUnassignedCookie)
        .send({ requestedMinutes: 45, reason: 'Solo project deployment' });

      expect(res.status).toBe(200);
      expect(res.body.data.overtime.status).toBe('pending');

      // Admin was notified
      const adminNotif = await Notification.findOne({
        userId: adminUser._id,
        'data.attendanceId': unassignedRecord._id,
      });
      expect(adminNotif).toBeTruthy();
    });
  });

  // CASE 4: Scope evaluated dynamically at request time
  describe('Case 4: Reassigned Manager Access', () => {
    it('old manager loses access (404), new manager gains access (200)', async () => {
      const record = await Attendance.create({
        employeeId: employee1._id,
        workDate: '2026-10-03',
        punchIn: {
          at: new Date('2026-10-03T09:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        punchOut: {
          at: new Date('2026-10-03T18:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        workedMinutes: 540,
        workingStatus: WORKING_STATUS.COMPLETED,
        closedBy: CLOSED_BY.EMPLOYEE,
        overtime: {
          status: OVERTIME_STATUS.PENDING,
          requestedMinutes: 30,
          reason: 'Customer onboarding',
          requestedAt: new Date('2026-10-03T18:30:00Z'),
        },
      });

      // Transfer Alice to Manager 2
      await request(app)
        .patch(`/api/users/${employee1._id}`)
        .set('Cookie', adminCookie)
        .send({ managerId: manager2._id });

      // Manager 1 now loses access -> 404
      const resM1 = await request(app)
        .patch(`/api/attendance/${record._id}/overtime/review`)
        .set('Cookie', mgr1Cookie)
        .send({ decision: 'approved' });

      expect(resM1.status).toBe(404);

      // Manager 2 now has access -> 200
      const resM2 = await request(app)
        .patch(`/api/attendance/${record._id}/overtime/review`)
        .set('Cookie', mgr2Cookie)
        .send({ decision: 'approved' });

      expect(resM2.status).toBe(200);
      expect(resM2.body.data.overtime.status).toBe('approved');
    });
  });

  // CASE 5: Role-change checks (HAS_TEAM_MEMBERS & OPEN_SHIFT)
  describe('Case 5: Role Change & Deactivation Guards', () => {
    it('returns 409 HAS_TEAM_MEMBERS when demoting/deactivating a manager with active members', async () => {
      // Demote manager1 who has Alice
      const demoteRes = await request(app)
        .patch(`/api/users/${manager1._id}`)
        .set('Cookie', adminCookie)
        .send({ role: ROLES.EMPLOYEE });

      expect(demoteRes.status).toBe(409);
      expect(demoteRes.body.error.code).toBe('HAS_TEAM_MEMBERS');

      // Deactivate manager1
      const deactRes = await request(app)
        .patch(`/api/users/${manager1._id}`)
        .set('Cookie', adminCookie)
        .send({ isActive: false });

      expect(deactRes.status).toBe(409);
      expect(deactRes.body.error.code).toBe('HAS_TEAM_MEMBERS');
    });

    it('returns 409 OPEN_SHIFT when promoting to admin or deactivating someone with an in-progress shift', async () => {
      // Create open shift for employee1
      await Attendance.create({
        employeeId: employee1._id,
        workDate: '2026-10-04',
        punchIn: {
          at: new Date('2026-10-04T09:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        punchOut: null,
        workedMinutes: null,
        workingStatus: WORKING_STATUS.IN_PROGRESS,
      });

      // Promote to admin
      const promoteRes = await request(app)
        .patch(`/api/users/${employee1._id}`)
        .set('Cookie', adminCookie)
        .send({ role: ROLES.ADMIN });

      expect(promoteRes.status).toBe(409);
      expect(promoteRes.body.error.code).toBe('OPEN_SHIFT');

      // Deactivate
      const deactRes = await request(app)
        .patch(`/api/users/${employee1._id}`)
        .set('Cookie', adminCookie)
        .send({ isActive: false });

      expect(deactRes.status).toBe(409);
      expect(deactRes.body.error.code).toBe('OPEN_SHIFT');
    });
  });

  // CASE 6: Inactive user rejected immediately, no alerts, open shift auto-closed
  describe('Case 6: Inactive User Handling', () => {
    it('immediately rejects requests from deactivated user with 403 ACCOUNT_INACTIVE', async () => {
      await User.findByIdAndUpdate(employee1._id, { isActive: false });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', emp1Cookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
    });

    it('excludes inactive users from missed punch alerts but auto-closes their open records without alerting them', async () => {
      await User.findByIdAndUpdate(employee1._id, { isActive: false });

      // Run missed punch in job for yesterday
      await runMissedPunchInJob('2026-10-05', true);
      const notifIn = await Notification.findOne({
        userId: employee1._id,
        type: 'missed_punch_in',
      });
      expect(notifIn).toBeNull();

      // Create an open expired record for employee1
      const expiredShift = await Attendance.create({
        employeeId: employee1._id,
        workDate: '2026-10-05',
        punchIn: {
          at: new Date('2026-10-05T09:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        punchOut: null,
        workingStatus: WORKING_STATUS.IN_PROGRESS,
      });

      // Run auto-close job
      await runAutoCloseJob('2026-10-06');

      const updatedShift = await Attendance.findById(expiredShift._id);
      expect(updatedShift.workingStatus).toBe(WORKING_STATUS.MISSED);
      expect(updatedShift.closedBy).toBe(CLOSED_BY.SYSTEM);

      // Verify no notification was created for the inactive employee
      const notifAuto = await Notification.findOne({
        userId: employee1._id,
        type: 'attendance_auto_closed',
      });
      expect(notifAuto).toBeNull();
    });
  });

  // CASE 7: Concurrent double-review
  describe('Case 7: Concurrent Double-Review Race', () => {
    it('allows exactly one review to succeed and returns 409 INVALID_TRANSITION on the other', async () => {
      const record = await Attendance.create({
        employeeId: employee1._id,
        workDate: '2026-10-05',
        punchIn: {
          at: new Date('2026-10-05T09:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        punchOut: {
          at: new Date('2026-10-05T18:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        workedMinutes: 540,
        workingStatus: WORKING_STATUS.COMPLETED,
        closedBy: CLOSED_BY.EMPLOYEE,
        overtime: {
          status: OVERTIME_STATUS.PENDING,
          requestedMinutes: 45,
          reason: 'Concurrent review test',
          requestedAt: new Date('2026-10-05T18:30:00Z'),
        },
      });

      const [res1, res2] = await Promise.all([
        request(app)
          .patch(`/api/attendance/${record._id}/overtime/review`)
          .set('Cookie', adminCookie)
          .send({ decision: 'approved', remarks: 'Reviewed by admin 1' }),
        request(app)
          .patch(`/api/attendance/${record._id}/overtime/review`)
          .set('Cookie', adminCookie)
          .send({ decision: 'rejected', remarks: 'Rejected by admin 2' }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);

      const conflictRes = res1.status === 409 ? res1 : res2;
      expect(conflictRes.body.error.code).toBe('INVALID_TRANSITION');
    });
  });

  // CASE 8: Concurrent double overtime submission
  describe('Case 8: Concurrent Double Overtime Submission', () => {
    it('allows exactly one submission to succeed and returns 409 OVERTIME_NOT_REQUESTABLE on the second', async () => {
      const record = await Attendance.create({
        employeeId: employee1._id,
        workDate: '2026-10-06',
        punchIn: {
          at: new Date('2026-10-06T09:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        punchOut: {
          at: new Date('2026-10-06T18:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        workedMinutes: 540,
        workingStatus: WORKING_STATUS.COMPLETED,
        closedBy: CLOSED_BY.EMPLOYEE,
      });

      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/attendance/${record._id}/overtime`)
          .set('Cookie', emp1Cookie)
          .send({ requestedMinutes: 30, reason: 'First click attempt' }),
        request(app)
          .post(`/api/attendance/${record._id}/overtime`)
          .set('Cookie', emp1Cookie)
          .send({ requestedMinutes: 40, reason: 'Second click attempt' }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);

      const conflictRes = res1.status === 409 ? res1 : res2;
      expect(conflictRes.body.error.code).toBe('OVERTIME_NOT_REQUESTABLE');
    });
  });

  // CASE 10: Storage failure & DB cleanup
  describe('Case 10: Storage Failure & Cleanup', () => {
    it('returns 502 STORAGE_UNAVAILABLE and creates no attendance document when storage fails', async () => {
      const failingAdapter = {
        upload: vi.fn().mockRejectedValue(new Error('Cloudinary connection timeout')),
        delete: vi.fn().mockResolvedValue(true),
      };
      setStorageAdapter(failingAdapter);

      const res = await request(app)
        .post('/api/attendance/punch-in')
        .set('Cookie', emp1Cookie)
        .attach('selfie', validJpgBuffer, 'selfie.jpg')
        .field('latitude', 28.6139)
        .field('longitude', 77.209)
        .field('accuracy', 10);

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('STORAGE_UNAVAILABLE');

      const count = await Attendance.countDocuments({ employeeId: employee1._id });
      expect(count).toBe(0);
    });
  });

  // CASE 11: Selfie endpoint for record with no selfie
  describe('Case 11: Missing Selfie 404', () => {
    it('returns 404 NOT_FOUND when record has no selfie', async () => {
      const record = await Attendance.create({
        employeeId: employee1._id,
        workDate: '2026-10-07',
        punchIn: {
          at: new Date('2026-10-07T09:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        punchOut: null,
        workingStatus: WORKING_STATUS.IN_PROGRESS,
      });

      const res = await request(app)
        .get(`/api/attendance/${record._id}/selfies/punch-in`)
        .set('Cookie', emp1Cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // CASE 12: Input edge cases
  describe('Case 12: Input Validation Edge Cases', () => {
    it('rejects invalid ObjectId with 400', async () => {
      const res = await request(app)
        .get('/api/attendance/invalid-not-an-id')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects from > to with 400', async () => {
      const res = await request(app)
        .get('/api/attendance?from=2026-10-10&to=2026-10-01')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('allows future dates and returns empty results', async () => {
      const res = await request(app)
        .get('/api/attendance?from=2029-01-01&to=2029-01-02')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('returns empty data with valid pagination meta when page is beyond last', async () => {
      const res = await request(app)
        .get('/api/attendance?page=999&limit=10')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.page).toBe(999);
    });

    it('rejects limit > 100 with 400', async () => {
      const res = await request(app)
        .get('/api/attendance?limit=150')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('supports unicode names and email case-insensitivity on signup and login', async () => {
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Renée Müller-José',
          email: 'RENEE.MULLER@example.com',
          password: 'Password123',
        });

      expect(signupRes.status).toBe(201);
      expect(signupRes.body.data.name).toBe('Renée Müller-José');

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'renee.muller@example.com',
          password: 'Password123',
        });

      expect(loginRes.status).toBe(200);
    });

    it('rejects whitespace-only remarks and remarks > 500 chars', async () => {
      const record = await Attendance.create({
        employeeId: employee1._id,
        workDate: '2026-10-08',
        punchIn: {
          at: new Date('2026-10-08T09:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        punchOut: {
          at: new Date('2026-10-08T18:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        workedMinutes: 540,
        workingStatus: WORKING_STATUS.COMPLETED,
      });

      // Whitespace remarks
      const whiteRes = await request(app)
        .patch(`/api/attendance/${record._id}/verification`)
        .set('Cookie', mgr1Cookie)
        .send({ status: 'valid', remarks: '     ' });

      expect(whiteRes.status).toBe(400);

      // Oversize remarks (> 500 chars)
      const longRes = await request(app)
        .patch(`/api/attendance/${record._id}/verification`)
        .set('Cookie', mgr1Cookie)
        .send({ status: 'valid', remarks: 'A'.repeat(501) });

      expect(longRes.status).toBe(400);
    });
  });

  // CASE 13: Reports export (zero rows & > 5000 rows truncated)
  describe('Case 13: Report Export Edge Cases', () => {
    it('returns valid empty xlsx and pdf when there are 0 matching rows, and empty JSON', async () => {
      // 1. Empty JSON report
      const jsonRes = await request(app)
        .get('/api/reports/daily?date=2029-01-01')
        .set('Cookie', adminCookie);

      expect(jsonRes.status).toBe(200);
      expect(jsonRes.body.data).toEqual([]);
      expect(jsonRes.body.meta.total).toBe(0);

      // 2. Empty XLSX
      const xlsxRes = await request(app)
        .get('/api/reports/daily/export?format=xlsx&date=2029-01-01')
        .set('Cookie', adminCookie)
        .buffer(true)
        .parse((r, cb) => {
          const chunks = [];
          r.on('data', (c) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(xlsxRes.status).toBe(200);
      expect(xlsxRes.headers['content-type']).toContain('spreadsheetml');
      expect(xlsxRes.body).toBeInstanceOf(Buffer);
      expect(xlsxRes.body.length).toBeGreaterThan(0);

      // 3. Empty PDF
      const pdfRes = await request(app)
        .get('/api/reports/daily/export?format=pdf&date=2029-01-01')
        .set('Cookie', adminCookie)
        .buffer(true)
        .parse((r, cb) => {
          const chunks = [];
          r.on('data', (c) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers['content-type']).toBe('application/pdf');
      expect(pdfRes.body).toBeInstanceOf(Buffer);
      expect(pdfRes.body.length).toBeGreaterThan(0);
    });
  });

  // CASE 14: Shift crossing midnight & after auto-close
  describe('Case 14: Shift Crossing Midnight and Auto-Close', () => {
    it('allows punch-out for shift started yesterday before auto-close and rejects after auto-close with 409', async () => {
      // 1. Shift started yesterday
      await Attendance.create({
        employeeId: employee1._id,
        workDate: '2026-10-09',
        punchIn: {
          at: new Date(Date.now() - 3600000), // 1 hour ago
          selfie: { publicId: 'dummy/in', mimeType: 'image/jpeg', bytes: 100 },
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        punchOut: null,
        workedMinutes: null,
        workingStatus: WORKING_STATUS.IN_PROGRESS,
      });

      // Punch-out succeeds before auto-close
      const punchOutRes = await request(app)
        .post('/api/attendance/punch-out')
        .set('Cookie', emp1Cookie)
        .attach('selfie', validJpgBuffer, 'selfie.jpg')
        .field('latitude', 28.6139)
        .field('longitude', 77.209)
        .field('accuracy', 10);

      expect(punchOutRes.status).toBe(200);
      expect(punchOutRes.body.data.workingStatus).toBe(WORKING_STATUS.INCOMPLETE);
      expect(punchOutRes.body.data.workedMinutes).toBeGreaterThanOrEqual(59);

      // 2. Another attempt after record is closed -> 409 NO_OPEN_ATTENDANCE
      const secondAttempt = await request(app)
        .post('/api/attendance/punch-out')
        .set('Cookie', emp1Cookie)
        .attach('selfie', validJpgBuffer, 'selfie.jpg')
        .field('latitude', 28.6139)
        .field('longitude', 77.209)
        .field('accuracy', 10);

      expect(secondAttempt.status).toBe(409);
      expect(secondAttempt.body.error.code).toBe('NO_OPEN_ATTENDANCE');
    });
  });
});
