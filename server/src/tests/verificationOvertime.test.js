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

describe('Verification & Overtime Endpoints (Phase 4)', () => {
  let _admin1;
  let _admin2;
  let manager1;
  let manager2;
  let employee1UnderM1;
  let employee2UnderM2;

  let admin1Cookie;
  let _admin2Cookie;
  let mgr1Cookie;
  let mgr2Cookie;
  let emp1Cookie;
  let emp2Cookie;

  beforeEach(async () => {
    const passwordHash = await User.hashPassword('Password123');

    _admin1 = await User.create({
      name: 'Admin Boss 1',
      email: 'admin1.vo@example.com',
      passwordHash,
      role: ROLES.ADMIN,
    });

    _admin2 = await User.create({
      name: 'Admin Boss 2',
      email: 'admin2.vo@example.com',
      passwordHash,
      role: ROLES.ADMIN,
    });

    manager1 = await User.create({
      name: 'Manager Mike',
      email: 'manager1.vo@example.com',
      passwordHash,
      role: ROLES.MANAGER,
    });

    manager2 = await User.create({
      name: 'Manager Dave',
      email: 'manager2.vo@example.com',
      passwordHash,
      role: ROLES.MANAGER,
    });

    employee1UnderM1 = await User.create({
      name: 'Alice Under M1',
      email: 'emp1.vo@example.com',
      passwordHash,
      role: ROLES.EMPLOYEE,
      managerId: manager1._id,
    });

    employee2UnderM2 = await User.create({
      name: 'Bob Under M2',
      email: 'emp2.vo@example.com',
      passwordHash,
      role: ROLES.EMPLOYEE,
      managerId: manager2._id,
    });

    // Login cookies
    const loginA1 = await request(app).post('/api/auth/login').send({
      email: 'admin1.vo@example.com',
      password: 'Password123',
    });
    admin1Cookie = loginA1.headers['set-cookie'];

    const loginA2 = await request(app).post('/api/auth/login').send({
      email: 'admin2.vo@example.com',
      password: 'Password123',
    });
    _admin2Cookie = loginA2.headers['set-cookie'];

    const loginM1 = await request(app).post('/api/auth/login').send({
      email: 'manager1.vo@example.com',
      password: 'Password123',
    });
    mgr1Cookie = loginM1.headers['set-cookie'];

    const loginM2 = await request(app).post('/api/auth/login').send({
      email: 'manager2.vo@example.com',
      password: 'Password123',
    });
    mgr2Cookie = loginM2.headers['set-cookie'];

    const loginE1 = await request(app).post('/api/auth/login').send({
      email: 'emp1.vo@example.com',
      password: 'Password123',
    });
    emp1Cookie = loginE1.headers['set-cookie'];

    const loginE2 = await request(app).post('/api/auth/login').send({
      email: 'emp2.vo@example.com',
      password: 'Password123',
    });
    emp2Cookie = loginE2.headers['set-cookie'];
  });

  describe('PATCH /api/attendance/:id/verification', () => {
    let completedRecord;
    let inProgressRecord;

    beforeEach(async () => {
      // Completed attendance record for Alice (under Manager 1)
      completedRecord = await Attendance.create({
        employeeId: employee1UnderM1._id,
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
      });

      // In progress record
      inProgressRecord = await Attendance.create({
        employeeId: employee1UnderM1._id,
        workDate: '2026-10-02',
        punchIn: {
          at: new Date('2026-10-02T09:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        punchOut: null,
        workedMinutes: null,
        workingStatus: WORKING_STATUS.IN_PROGRESS,
      });
    });

    it('rejects review on in_progress attendance with 409 CANNOT_REVIEW_IN_PROGRESS', async () => {
      const res = await request(app)
        .patch(`/api/attendance/${inProgressRecord._id}/verification`)
        .set('Cookie', mgr1Cookie)
        .send({ status: 'valid' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CANNOT_REVIEW_IN_PROGRESS');
    });

    it('rejects self-review with 403 FORBIDDEN for manager on own attendance', async () => {
      const mgrRecord = await Attendance.create({
        employeeId: manager1._id,
        workDate: '2026-10-01',
        punchIn: {
          at: new Date('2026-10-01T09:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        punchOut: {
          at: new Date('2026-10-01T17:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        workedMinutes: 480,
        workingStatus: WORKING_STATUS.COMPLETED,
      });

      const res = await request(app)
        .patch(`/api/attendance/${mgrRecord._id}/verification`)
        .set('Cookie', mgr1Cookie)
        .send({ status: 'valid' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 404 NOT_FOUND to out-of-scope manager reviewing another team', async () => {
      const res = await request(app)
        .patch(`/api/attendance/${completedRecord._id}/verification`)
        .set('Cookie', mgr2Cookie) // Manager 2 has no scope over Alice
        .send({ status: 'valid' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('blocks employee from calling verification with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .patch(`/api/attendance/${completedRecord._id}/verification`)
        .set('Cookie', emp1Cookie)
        .send({ status: 'valid' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('requires remarks between 5 and 500 chars when marking invalid', async () => {
      // Missing remarks
      const res1 = await request(app)
        .patch(`/api/attendance/${completedRecord._id}/verification`)
        .set('Cookie', mgr1Cookie)
        .send({ status: 'invalid' });

      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe('VALIDATION_ERROR');

      // Remarks too short (< 5 chars)
      const res2 = await request(app)
        .patch(`/api/attendance/${completedRecord._id}/verification`)
        .set('Cookie', mgr1Cookie)
        .send({ status: 'invalid', remarks: 'bad' });

      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe('VALIDATION_ERROR');

      // Valid remarks (>= 5 chars) succeeds
      const res3 = await request(app)
        .patch(`/api/attendance/${completedRecord._id}/verification`)
        .set('Cookie', mgr1Cookie)
        .send({ status: 'invalid', remarks: 'Punch in selfie is pitch black' });

      expect(res3.status).toBe(200);
      expect(res3.body.data.verification.status).toBe('invalid');
      expect(res3.body.data.verification.remarks).toBe('Punch in selfie is pitch black');
    });

    it('allows valid verification with optional remarks and appends history', async () => {
      // 1. Mark valid with optional remarks
      const res1 = await request(app)
        .patch(`/api/attendance/${completedRecord._id}/verification`)
        .set('Cookie', mgr1Cookie)
        .send({ status: 'valid', remarks: 'Verified looks good' });

      expect(res1.status).toBe(200);
      expect(res1.body.data.verification.status).toBe('valid');
      expect(res1.body.data.verification.history).toHaveLength(1);
      expect(res1.body.data.verification.history[0].status).toBe('valid');

      // 2. Re-review allowed: Admin re-reviews and marks invalid
      const res2 = await request(app)
        .patch(`/api/attendance/${completedRecord._id}/verification`)
        .set('Cookie', admin1Cookie)
        .send({ status: 'invalid', remarks: 'Re-reviewed: location discrepancy' });

      expect(res2.status).toBe(200);
      expect(res2.body.data.verification.status).toBe('invalid');
      expect(res2.body.data.verification.history).toHaveLength(2);
      expect(res2.body.data.verification.history[1].status).toBe('invalid');
      expect(res2.body.data.verification.history[1].remarks).toBe(
        'Re-reviewed: location discrepancy'
      );
    });
  });

  describe('POST /api/attendance/:id/overtime', () => {
    let completedShift540;

    beforeEach(async () => {
      completedShift540 = await Attendance.create({
        employeeId: employee1UnderM1._id,
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
        workedMinutes: 540, // 60 minutes overtime available
        workingStatus: WORKING_STATUS.COMPLETED,
        closedBy: CLOSED_BY.EMPLOYEE,
      });
    });

    it('returns 404 NOT_FOUND when non-owner requests overtime', async () => {
      const res = await request(app)
        .post(`/api/attendance/${completedShift540._id}/overtime`)
        .set('Cookie', emp2Cookie) // Bob requests Alice's record
        .send({ requestedMinutes: 30, reason: 'Helped client on urgent ticket' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('rejects overtime for non-completed shift with 409 OVERTIME_NOT_REQUESTABLE', async () => {
      const incompleteRecord = await Attendance.create({
        employeeId: employee1UnderM1._id,
        workDate: '2026-10-04',
        punchIn: {
          at: new Date('2026-10-04T09:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        punchOut: {
          at: new Date('2026-10-04T15:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        workedMinutes: 360,
        workingStatus: WORKING_STATUS.INCOMPLETE,
        closedBy: CLOSED_BY.EMPLOYEE,
      });

      const res = await request(app)
        .post(`/api/attendance/${incompleteRecord._id}/overtime`)
        .set('Cookie', emp1Cookie)
        .send({ requestedMinutes: 30, reason: 'Worked extra hours on project' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('OVERTIME_NOT_REQUESTABLE');
    });

    it('rejects overtime when workedMinutes <= 480 with 409 OVERTIME_NOT_REQUESTABLE', async () => {
      const exact480 = await Attendance.create({
        employeeId: employee1UnderM1._id,
        workDate: '2026-10-05',
        punchIn: {
          at: new Date('2026-10-05T09:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        punchOut: {
          at: new Date('2026-10-05T17:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        workedMinutes: 480,
        workingStatus: WORKING_STATUS.COMPLETED,
        closedBy: CLOSED_BY.EMPLOYEE,
      });

      const res = await request(app)
        .post(`/api/attendance/${exact480._id}/overtime`)
        .set('Cookie', emp1Cookie)
        .send({ requestedMinutes: 15, reason: 'Stayed back for meetings' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('OVERTIME_NOT_REQUESTABLE');
    });

    it('rejects overtime when verification is invalid with 409 OVERTIME_NOT_REQUESTABLE', async () => {
      completedShift540.verification.status = VERIFICATION_STATUS.INVALID;
      completedShift540.verification.remarks = 'Invalid location';
      await completedShift540.save();

      const res = await request(app)
        .post(`/api/attendance/${completedShift540._id}/overtime`)
        .set('Cookie', emp1Cookie)
        .send({ requestedMinutes: 30, reason: 'Worked late on release' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('OVERTIME_NOT_REQUESTABLE');
    });

    it('rejects requestedMinutes > workedMinutes - 480 with 400 VALIDATION_ERROR', async () => {
      // 540 - 480 = 60 max minutes
      const res = await request(app)
        .post(`/api/attendance/${completedShift540._id}/overtime`)
        .set('Cookie', emp1Cookie)
        .send({ requestedMinutes: 75, reason: 'Worked overtime on support' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('successfully requests overtime within limit and blocks duplicate pending with 409', async () => {
      // 1. Initial request succeeds
      const res = await request(app)
        .post(`/api/attendance/${completedShift540._id}/overtime`)
        .set('Cookie', emp1Cookie)
        .send({ requestedMinutes: 45, reason: 'Helped client on urgent ticket' });

      expect(res.status).toBe(200);
      expect(res.body.data.overtime.status).toBe('pending');
      expect(res.body.data.overtime.requestedMinutes).toBe(45);
      expect(res.body.data.overtime.reason).toBe('Helped client on urgent ticket');

      // 2. Duplicate pending request rejected
      const dupRes = await request(app)
        .post(`/api/attendance/${completedShift540._id}/overtime`)
        .set('Cookie', emp1Cookie)
        .send({ requestedMinutes: 30, reason: 'Second request attempt' });

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.error.code).toBe('OVERTIME_NOT_REQUESTABLE');
    });
  });

  describe('PATCH /api/attendance/:id/overtime/review & Resubmission Flow', () => {
    let pendingAttendance;

    beforeEach(async () => {
      pendingAttendance = await Attendance.create({
        employeeId: employee1UnderM1._id,
        workDate: '2026-10-06',
        punchIn: {
          at: new Date('2026-10-06T09:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        punchOut: {
          at: new Date('2026-10-06T18:30:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        workedMinutes: 570,
        workingStatus: WORKING_STATUS.COMPLETED,
        closedBy: CLOSED_BY.EMPLOYEE,
        overtime: {
          status: OVERTIME_STATUS.PENDING,
          requestedMinutes: 60,
          reason: 'Deployment support after hours',
          requestedAt: new Date('2026-10-06T19:00:00Z'),
        },
      });
    });

    it('rejects review on non-pending overtime with 409 INVALID_TRANSITION', async () => {
      // Record with not_requested overtime
      const notReqRecord = await Attendance.create({
        employeeId: employee1UnderM1._id,
        workDate: '2026-10-07',
        punchIn: {
          at: new Date('2026-10-07T09:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        punchOut: {
          at: new Date('2026-10-07T17:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        workedMinutes: 480,
        workingStatus: WORKING_STATUS.COMPLETED,
      });

      const res = await request(app)
        .patch(`/api/attendance/${notReqRecord._id}/overtime/review`)
        .set('Cookie', mgr1Cookie)
        .send({ decision: 'approved' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
    });

    it('blocks approving overtime when verification is invalid with 409 ATTENDANCE_INVALID', async () => {
      pendingAttendance.verification.status = VERIFICATION_STATUS.INVALID;
      pendingAttendance.verification.remarks = 'Location fraud suspected';
      await pendingAttendance.save();

      const res = await request(app)
        .patch(`/api/attendance/${pendingAttendance._id}/overtime/review`)
        .set('Cookie', mgr1Cookie)
        .send({ decision: 'approved' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ATTENDANCE_INVALID');
    });

    it('requires remarks between 5 and 500 characters when rejecting overtime', async () => {
      // Missing remarks
      const res1 = await request(app)
        .patch(`/api/attendance/${pendingAttendance._id}/overtime/review`)
        .set('Cookie', mgr1Cookie)
        .send({ decision: 'rejected' });

      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe('VALIDATION_ERROR');

      // Remarks too short (< 5 chars)
      const res2 = await request(app)
        .patch(`/api/attendance/${pendingAttendance._id}/overtime/review`)
        .set('Cookie', mgr1Cookie)
        .send({ decision: 'rejected', remarks: 'no' });

      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects overtime with remarks, appends history, and allows employee resubmission', async () => {
      // 1. Manager rejects with remarks
      const rejectRes = await request(app)
        .patch(`/api/attendance/${pendingAttendance._id}/overtime/review`)
        .set('Cookie', mgr1Cookie)
        .send({ decision: 'rejected', remarks: 'Not pre-approved by lead' });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.overtime.status).toBe('rejected');
      expect(rejectRes.body.data.overtime.remarks).toBe('Not pre-approved by lead');
      expect(rejectRes.body.data.overtime.history).toHaveLength(1);
      expect(rejectRes.body.data.overtime.history[0].status).toBe('rejected');

      // 2. Employee resubmits overtime request after rejection
      const resubmitRes = await request(app)
        .post(`/api/attendance/${pendingAttendance._id}/overtime`)
        .set('Cookie', emp1Cookie)
        .send({
          requestedMinutes: 45,
          reason: 'Discussed with manager and approved for 45 mins',
        });

      expect(resubmitRes.status).toBe(200);
      expect(resubmitRes.body.data.overtime.status).toBe('pending');
      expect(resubmitRes.body.data.overtime.requestedMinutes).toBe(45);
      // History still retains the previously rejected event
      expect(resubmitRes.body.data.overtime.history).toHaveLength(1);

      // 3. Manager now approves the resubmitted request
      const approveRes = await request(app)
        .patch(`/api/attendance/${pendingAttendance._id}/overtime/review`)
        .set('Cookie', mgr1Cookie)
        .send({ decision: 'approved', remarks: 'Approved after clarification' });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.overtime.status).toBe('approved');
      expect(approveRes.body.data.overtime.history).toHaveLength(2);
      expect(approveRes.body.data.overtime.history[1].status).toBe('approved');
    });

    it('allows Admin to review Manager overtime; blocks Manager self-review (403) and cross-manager review (404)', async () => {
      const managerRecord = await Attendance.create({
        employeeId: manager1._id,
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
        overtime: {
          status: OVERTIME_STATUS.PENDING,
          requestedMinutes: 45,
          reason: 'Server migration maintenance',
          requestedAt: new Date('2026-10-08T19:00:00Z'),
        },
      });

      // Manager 1 cannot review own record -> 403 FORBIDDEN
      const selfRes = await request(app)
        .patch(`/api/attendance/${managerRecord._id}/overtime/review`)
        .set('Cookie', mgr1Cookie)
        .send({ decision: 'approved' });

      expect(selfRes.status).toBe(403);
      expect(selfRes.body.error.code).toBe('FORBIDDEN');

      // Manager 2 cannot review Manager 1 record -> 404 NOT_FOUND
      const crossMgrRes = await request(app)
        .patch(`/api/attendance/${managerRecord._id}/overtime/review`)
        .set('Cookie', mgr2Cookie)
        .send({ decision: 'approved' });

      expect(crossMgrRes.status).toBe(404);
      expect(crossMgrRes.body.error.code).toBe('NOT_FOUND');

      // Admin can review Manager 1 record -> 200 OK
      const adminRes = await request(app)
        .patch(`/api/attendance/${managerRecord._id}/overtime/review`)
        .set('Cookie', admin1Cookie)
        .send({ decision: 'approved' });

      expect(adminRes.status).toBe(200);
      expect(adminRes.body.data.overtime.status).toBe('approved');
    });
  });

  describe('GET /api/overtime/pending', () => {
    beforeEach(async () => {
      // Pending overtime for Alice (under Manager 1)
      await Attendance.create({
        employeeId: employee1UnderM1._id,
        workDate: '2026-10-09',
        punchIn: {
          at: new Date('2026-10-09T09:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        punchOut: {
          at: new Date('2026-10-09T18:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        workedMinutes: 540,
        workingStatus: WORKING_STATUS.COMPLETED,
        overtime: {
          status: OVERTIME_STATUS.PENDING,
          requestedMinutes: 60,
          reason: 'Alice urgent project tasks',
          requestedAt: new Date('2026-10-09T19:00:00Z'),
        },
      });

      // Pending overtime for Bob (under Manager 2)
      await Attendance.create({
        employeeId: employee2UnderM2._id,
        workDate: '2026-10-09',
        punchIn: {
          at: new Date('2026-10-09T09:00:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        punchOut: {
          at: new Date('2026-10-09T18:30:00Z'),
          selfie: null,
          location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 },
        },
        workedMinutes: 570,
        workingStatus: WORKING_STATUS.COMPLETED,
        overtime: {
          status: OVERTIME_STATUS.PENDING,
          requestedMinutes: 90,
          reason: 'Bob ops maintenance tasks',
          requestedAt: new Date('2026-10-09T19:15:00Z'),
        },
      });
    });

    it('forbids employees from viewing pending overtime queue with 403', async () => {
      const res = await request(app)
        .get('/api/overtime/pending')
        .set('Cookie', emp1Cookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns only team members pending requests for manager', async () => {
      const res = await request(app)
        .get('/api/overtime/pending')
        .set('Cookie', mgr1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].employeeId._id).toBe(employee1UnderM1._id.toString());
      expect(res.body.meta.total).toBe(1);
    });

    it('returns all pending overtime requests system-wide for admin', async () => {
      const res = await request(app)
        .get('/api/overtime/pending')
        .set('Cookie', admin1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });
  });
});
