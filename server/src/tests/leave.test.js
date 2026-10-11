import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { User } from '../models/user.model.js';
import { LeaveRequest } from '../models/leave.model.js';
import { Attendance } from '../models/attendance.model.js';
import { Notification } from '../models/notification.model.js';
import {
  ROLES,
  LEAVE_STATUS,
  LEAVE_TYPE,
  NOTIFICATION_TYPES,
  WORKING_STATUS,
} from '../config/constants.js';

describe('Leave Management Module End-to-End Tests', () => {
  let admin;
  let manager1;
  let manager2;
  let employee1;
  let _employee2;
  let _unassignedEmp;

  let adminCookie;
  let mgr1Cookie;
  let mgr2Cookie;
  let emp1Cookie;
  let emp2Cookie;
  let unassignedEmpCookie;

  beforeEach(async () => {
    const passwordHash = await User.hashPassword('Password123');

    admin = await User.create({
      name: 'System Admin',
      email: 'admin.leave@example.com',
      passwordHash,
      role: ROLES.ADMIN,
    });

    manager1 = await User.create({
      name: 'Team Manager 1',
      email: 'manager1.leave@example.com',
      passwordHash,
      role: ROLES.MANAGER,
    });

    manager2 = await User.create({
      name: 'Team Manager 2',
      email: 'manager2.leave@example.com',
      passwordHash,
      role: ROLES.MANAGER,
    });

    employee1 = await User.create({
      name: 'Employee Alice',
      email: 'alice.leave@example.com',
      passwordHash,
      role: ROLES.EMPLOYEE,
      managerId: manager1._id,
    });

    _employee2 = await User.create({
      name: 'Employee Bob',
      email: 'bob.leave@example.com',
      passwordHash,
      role: ROLES.EMPLOYEE,
      managerId: manager2._id,
    });

    _unassignedEmp = await User.create({
      name: 'Employee Charlie (Unassigned)',
      email: 'charlie.leave@example.com',
      passwordHash,
      role: ROLES.EMPLOYEE,
      managerId: null,
    });

    // Obtain session cookies
    const login = async (email) => {
      const res = await request(app).post('/api/auth/login').send({
        email,
        password: 'Password123',
      });
      return res.headers['set-cookie'];
    };

    adminCookie = await login('admin.leave@example.com');
    mgr1Cookie = await login('manager1.leave@example.com');
    mgr2Cookie = await login('manager2.leave@example.com');
    emp1Cookie = await login('alice.leave@example.com');
    emp2Cookie = await login('bob.leave@example.com');
    unassignedEmpCookie = await login('charlie.leave@example.com');
  });

  describe('POST /api/leave (Leave Application)', () => {
    it('allows employee to apply for full-day leave and accurately computes working days', async () => {
      // 2026-10-12 is Monday, 2026-10-16 is Friday = 5 working days
      const res = await request(app)
        .post('/api/leave')
        .set('Cookie', emp1Cookie)
        .send({
          leaveType: LEAVE_TYPE.ANNUAL,
          startDate: '2026-10-12',
          endDate: '2026-10-16',
          reason: 'Annual family holiday vacation',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.daysCount).toBe(5);
      expect(res.body.data.status).toBe(LEAVE_STATUS.PENDING);
      expect(res.body.data.isHalfDay).toBe(false);

      // Verify manager was notified
      const notif = await Notification.findOne({
        userId: manager1._id,
        type: NOTIFICATION_TYPES.LEAVE_REQUESTED,
      });
      expect(notif).toBeDefined();
      expect(notif.message).toContain('Alice');
    });

    it('excludes weekends when computing working days', async () => {
      // 2026-10-16 (Fri) to 2026-10-19 (Mon) = 2 working days (Fri + Mon, excluding Sat 17 and Sun 18)
      const res = await request(app)
        .post('/api/leave')
        .set('Cookie', emp1Cookie)
        .send({
          leaveType: LEAVE_TYPE.CASUAL,
          startDate: '2026-10-16',
          endDate: '2026-10-19',
          reason: 'Personal urgent appointment',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.daysCount).toBe(2);
    });

    it('rejects leave application if date range contains zero working days (weekends only)', async () => {
      // 2026-10-17 is Saturday, 2026-10-18 is Sunday
      const res = await request(app)
        .post('/api/leave')
        .set('Cookie', emp1Cookie)
        .send({
          leaveType: LEAVE_TYPE.CASUAL,
          startDate: '2026-10-17',
          endDate: '2026-10-18',
          reason: 'Weekend trip personal reasons',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NO_WORKING_DAYS');
    });

    it('supports single-date half-day leave with exactly 0.5 days count', async () => {
      // 2026-10-14 is Wednesday
      const res = await request(app)
        .post('/api/leave')
        .set('Cookie', emp1Cookie)
        .send({
          leaveType: LEAVE_TYPE.SICK,
          startDate: '2026-10-14',
          endDate: '2026-10-14',
          isHalfDay: true,
          halfDayPeriod: 'first_half',
          reason: 'Dentist appointment in the morning',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.daysCount).toBe(0.5);
      expect(res.body.data.isHalfDay).toBe(true);
      expect(res.body.data.halfDayPeriod).toBe('first_half');
    });

    it('rejects half-day leave spanning multiple dates with validation error', async () => {
      const res = await request(app)
        .post('/api/leave')
        .set('Cookie', emp1Cookie)
        .send({
          leaveType: LEAVE_TYPE.SICK,
          startDate: '2026-10-13',
          endDate: '2026-10-14',
          isHalfDay: true,
          halfDayPeriod: 'first_half',
          reason: 'Trying invalid multi-day half-day',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('prevents overlapping pending or approved leave requests with 409 OVERLAPPING_LEAVE', async () => {
      // First request: Oct 12 to Oct 14
      await request(app)
        .post('/api/leave')
        .set('Cookie', emp1Cookie)
        .send({
          leaveType: LEAVE_TYPE.ANNUAL,
          startDate: '2026-10-12',
          endDate: '2026-10-14',
          reason: 'Trip to family hometown',
        });

      // Second request overlapping: Oct 13 to Oct 15
      const res = await request(app)
        .post('/api/leave')
        .set('Cookie', emp1Cookie)
        .send({
          leaveType: LEAVE_TYPE.ANNUAL,
          startDate: '2026-10-13',
          endDate: '2026-10-15',
          reason: 'Overlapping request attempt',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('OVERLAPPING_LEAVE');
    });

    it('blocks Admin users from applying for workforce leave', async () => {
      const res = await request(app)
        .post('/api/leave')
        .set('Cookie', adminCookie)
        .send({
          leaveType: LEAVE_TYPE.ANNUAL,
          startDate: '2026-10-12',
          endDate: '2026-10-14',
          reason: 'Admin taking leave',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ADMIN_NOT_ELIGIBLE');
    });

    it('notifies all admins when an employee without a manager applies for leave', async () => {
      const res = await request(app)
        .post('/api/leave')
        .set('Cookie', unassignedEmpCookie)
        .send({
          leaveType: LEAVE_TYPE.ANNUAL,
          startDate: '2026-10-12',
          endDate: '2026-10-13',
          reason: 'Need time off for family wedding',
        });

      expect(res.status).toBe(201);

      const notif = await Notification.findOne({
        userId: admin._id,
        type: NOTIFICATION_TYPES.LEAVE_REQUESTED,
      });
      expect(notif).toBeDefined();
    });
  });

  describe('GET /api/leave/me and /api/leave/team (Role Scoping)', () => {
    beforeEach(async () => {
      // Alice (manager1 team) applies
      await request(app)
        .post('/api/leave')
        .set('Cookie', emp1Cookie)
        .send({
          leaveType: LEAVE_TYPE.ANNUAL,
          startDate: '2026-10-12',
          endDate: '2026-10-14',
          reason: 'Alice first trip',
        });

      // Bob (manager2 team) applies
      await request(app)
        .post('/api/leave')
        .set('Cookie', emp2Cookie)
        .send({
          leaveType: LEAVE_TYPE.SICK,
          startDate: '2026-10-15',
          endDate: '2026-10-16',
          reason: 'Bob sick leave',
        });
    });

    it('employee /api/leave/me returns only their own leave requests', async () => {
      const res = await request(app)
        .get('/api/leave/me')
        .set('Cookie', emp1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].reason).toBe('Alice first trip');
    });

    it('manager /api/leave/team returns only requests from their assigned team members', async () => {
      const res = await request(app)
        .get('/api/leave/team')
        .set('Cookie', mgr1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].reason).toBe('Alice first trip');
    });

    it('manager cannot see requests from another manager team in /api/leave/team', async () => {
      const res = await request(app)
        .get('/api/leave/team')
        .set('Cookie', mgr2Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].reason).toBe('Bob sick leave');
    });

    it('admin /api/leave returns all organization-wide requests', async () => {
      const res = await request(app)
        .get('/api/leave')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });
  });

  describe('PATCH /api/leave/:id/cancel (Cancellation Lifecycle)', () => {
    let leaveId;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/api/leave')
        .set('Cookie', emp1Cookie)
        .send({
          leaveType: LEAVE_TYPE.CASUAL,
          startDate: '2026-10-20',
          endDate: '2026-10-21',
          reason: 'Trip planned for next week',
        });
      leaveId = createRes.body.data._id;
    });

    it('employee can cancel their own pending leave request', async () => {
      const res = await request(app)
        .patch(`/api/leave/${leaveId}/cancel`)
        .set('Cookie', emp1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(LEAVE_STATUS.CANCELLED);

      const inDb = await LeaveRequest.findById(leaveId);
      expect(inDb.status).toBe(LEAVE_STATUS.CANCELLED);
    });

    it('forbids other employees from cancelling another user leave request with 403', async () => {
      const res = await request(app)
        .patch(`/api/leave/${leaveId}/cancel`)
        .set('Cookie', emp2Cookie);

      expect(res.status).toBe(403);
    });

    it('rejects cancellation on already reviewed leave with 409 INVALID_TRANSITION', async () => {
      // Manager approves it
      await request(app)
        .patch(`/api/leave/${leaveId}/review`)
        .set('Cookie', mgr1Cookie)
        .send({ action: 'approve' });

      // Employee tries to cancel
      const res = await request(app)
        .patch(`/api/leave/${leaveId}/cancel`)
        .set('Cookie', emp1Cookie);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
    });
  });

  describe('PATCH /api/leave/:id/review (Approval & Rejection Rules)', () => {
    let aliceLeaveId;
    let bobLeaveId;
    let unassignedLeaveId;
    let manager1LeaveId;

    beforeEach(async () => {
      // Alice (mgr1 team)
      const res1 = await request(app)
        .post('/api/leave')
        .set('Cookie', emp1Cookie)
        .send({
          leaveType: LEAVE_TYPE.ANNUAL,
          startDate: '2026-10-26',
          endDate: '2026-10-28',
          reason: 'Alice fall vacation',
        });
      aliceLeaveId = res1.body.data._id;

      // Bob (mgr2 team)
      const res2 = await request(app)
        .post('/api/leave')
        .set('Cookie', emp2Cookie)
        .send({
          leaveType: LEAVE_TYPE.CASUAL,
          startDate: '2026-10-26',
          endDate: '2026-10-27',
          reason: 'Bob doctor visit',
        });
      bobLeaveId = res2.body.data._id;

      // Unassigned employee (no manager)
      const res3 = await request(app)
        .post('/api/leave')
        .set('Cookie', unassignedEmpCookie)
        .send({
          leaveType: LEAVE_TYPE.ANNUAL,
          startDate: '2026-10-26',
          endDate: '2026-10-28',
          reason: 'Charlie personal days',
        });
      unassignedLeaveId = res3.body.data._id;

      // Manager 1 also submits leave for themself
      const res4 = await request(app)
        .post('/api/leave')
        .set('Cookie', mgr1Cookie)
        .send({
          leaveType: LEAVE_TYPE.ANNUAL,
          startDate: '2026-10-29',
          endDate: '2026-10-30',
          reason: 'Manager Mike holiday',
        });
      manager1LeaveId = res4.body.data._id;
    });

    it('manager can approve team member leave and saves reviewer identity', async () => {
      const res = await request(app)
        .patch(`/api/leave/${aliceLeaveId}/review`)
        .set('Cookie', mgr1Cookie)
        .send({
          action: 'approve',
          remarks: 'Approved, enjoy your time off!',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(LEAVE_STATUS.APPROVED);
      expect(res.body.data.reviewerRemarks).toBe('Approved, enjoy your time off!');
      expect(res.body.data.reviewedBy).toBe(manager1._id.toString());

      // Check notification sent to Alice
      const notif = await Notification.findOne({
        userId: employee1._id,
        type: NOTIFICATION_TYPES.LEAVE_APPROVED,
      });
      expect(notif).toBeDefined();
      expect(notif.message).toContain('approved');
    });

    it('manager can reject team member leave with required remarks (>= 5 chars)', async () => {
      const res = await request(app)
        .patch(`/api/leave/${aliceLeaveId}/review`)
        .set('Cookie', mgr1Cookie)
        .send({
          action: 'reject',
          remarks: 'Critical project release scheduled on these days',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(LEAVE_STATUS.REJECTED);

      // Check notification sent to Alice
      const notif = await Notification.findOne({
        userId: employee1._id,
        type: NOTIFICATION_TYPES.LEAVE_REJECTED,
      });
      expect(notif).toBeDefined();
      expect(notif.message).toContain('rejected');
    });

    it('requires remarks when rejecting leave', async () => {
      const res = await request(app)
        .patch(`/api/leave/${aliceLeaveId}/review`)
        .set('Cookie', mgr1Cookie)
        .send({
          action: 'reject',
          remarks: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('manager CANNOT approve their own leave request (403 CANNOT_SELF_REVIEW)', async () => {
      const res = await request(app)
        .patch(`/api/leave/${manager1LeaveId}/review`)
        .set('Cookie', mgr1Cookie)
        .send({
          action: 'approve',
          remarks: 'Self approval',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CANNOT_SELF_REVIEW');
    });

    it('manager cannot approve leave for an employee outside their team (403 OUT_OF_SCOPE)', async () => {
      // Manager 1 tries to review Bob (who reports to Manager 2)
      const res = await request(app)
        .patch(`/api/leave/${bobLeaveId}/review`)
        .set('Cookie', mgr1Cookie)
        .send({
          action: 'approve',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('OUT_OF_SCOPE');
    });

    it('admin can review leave for an employee with no assigned manager', async () => {
      const res = await request(app)
        .patch(`/api/leave/${unassignedLeaveId}/review`)
        .set('Cookie', adminCookie)
        .send({
          action: 'approve',
          remarks: 'Approved by executive administration',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(LEAVE_STATUS.APPROVED);
    });

    it('admin can review manager leave request', async () => {
      const res = await request(app)
        .patch(`/api/leave/${manager1LeaveId}/review`)
        .set('Cookie', adminCookie)
        .send({
          action: 'approve',
          remarks: 'Executive approval for manager leave',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(LEAVE_STATUS.APPROVED);
    });

    it('approved leave preserves actual attendance records that conflict with leave dates', async () => {
      // Pre-create an attendance record for Alice on 2026-10-26 (first day of leave)
      const attendance = await Attendance.create({
        employeeId: employee1._id,
        workDate: '2026-10-26',
        punchIn: {
          at: new Date('2026-10-26T09:00:00.000Z'),
          selfie: { publicId: 'dummy_id' },
          location: { latitude: 12.9716, longitude: 77.5946, accuracy: 15 },
        },
        workingStatus: WORKING_STATUS.IN_PROGRESS,
      });

      // Manager approves Alice's leave covering 2026-10-26
      await request(app)
        .patch(`/api/leave/${aliceLeaveId}/review`)
        .set('Cookie', mgr1Cookie)
        .send({ action: 'approve' });

      // Verify attendance record was NOT deleted
      const existingAttendance = await Attendance.findById(attendance._id);
      expect(existingAttendance).toBeDefined();
      expect(existingAttendance.verification.remarks).toContain('preserved');
    });
  });
});
