import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import http from 'http';
import { io as Client } from 'socket.io-client';
import app from '../app.js';
import { User } from '../models/user.model.js';
import { Attendance } from '../models/attendance.model.js';
import { Notification } from '../models/notification.model.js';
import {
  ROLES,
  NOTIFICATION_TYPES,
  WORKING_STATUS,
  VERIFICATION_STATUS,
  OVERTIME_STATUS,
} from '../config/constants.js';
import {
  initSocketServer,
  emitNotification,
  emitAttendanceUpdated,
} from '../realtime/socket.js';
import {
  runMissedPunchInJob,
  runMissedPunchOutJob,
  runAutoCloseJob,
} from '../jobs/index.js';
import {
  notifyVerificationReviewed,
  notifyOvertimeRequested,
  notifyOvertimeReviewed,
} from '../services/notification.service.js';
import { getWorkDate } from '../utils/time.js';

describe('Phase 6 — Notifications, Scheduled Jobs, Realtime & Rate Limiting', () => {
  let adminUser;
  let managerUser;
  let emp1User;
  let emp2User;

  let adminCookie;
  let _mgrCookie;
  let emp1Cookie;
  let emp2Cookie;

  let httpServer;
  let ioServer;
  let serverPort;

  beforeAll(async () => {
    httpServer = http.createServer(app);
    ioServer = initSocketServer(httpServer);
    await new Promise((resolve) => httpServer.listen(0, resolve));
    serverPort = httpServer.address().port;
  });

  afterAll(async () => {
    if (ioServer) {
      await new Promise((resolve) => ioServer.close(resolve));
    }
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
  });

  beforeEach(async () => {
    const passwordHash = await User.hashPassword('Password123');

    adminUser = await User.create({
      name: 'Admin Boss',
      email: 'admin.notif@example.com',
      passwordHash,
      role: ROLES.ADMIN,
      isActive: true,
    });

    managerUser = await User.create({
      name: 'Manager Mary',
      email: 'mgr.notif@example.com',
      passwordHash,
      role: ROLES.MANAGER,
      isActive: true,
    });

    emp1User = await User.create({
      name: 'Employee Evan',
      email: 'evan.notif@example.com',
      passwordHash,
      role: ROLES.EMPLOYEE,
      managerId: managerUser._id,
      isActive: true,
    });

    emp2User = await User.create({
      name: 'Employee Emma',
      email: 'emma.notif@example.com',
      passwordHash,
      role: ROLES.EMPLOYEE,
      managerId: managerUser._id,
      isActive: true,
    });

    const loginA = await request(app).post('/api/auth/login').send({
      email: 'admin.notif@example.com',
      password: 'Password123',
    });
    adminCookie = loginA.headers['set-cookie'];

    const loginM = await request(app).post('/api/auth/login').send({
      email: 'mgr.notif@example.com',
      password: 'Password123',
    });
    _mgrCookie = loginM.headers['set-cookie'];

    const loginE1 = await request(app).post('/api/auth/login').send({
      email: 'evan.notif@example.com',
      password: 'Password123',
    });
    emp1Cookie = loginE1.headers['set-cookie'];

    const loginE2 = await request(app).post('/api/auth/login').send({
      email: 'emma.notif@example.com',
      password: 'Password123',
    });
    emp2Cookie = loginE2.headers['set-cookie'];
  });

  // 1. Rate Limiter Test
  describe('Rate Limiter Behavior', () => {
    afterEach(() => {
      delete process.env.TEST_ENABLE_RATE_LIMITS;
    });

    it('returns 429 RATE_LIMITED when rate limiters are explicitly enabled and exceeded', async () => {
      process.env.TEST_ENABLE_RATE_LIMITS = 'true';

      // signupLimiter has a limit of 5 requests per hour
      const responses = [];
      for (let i = 0; i < 6; i++) {
        const res = await request(app)
          .post('/api/auth/signup')
          .send({
            name: `User ${i}`,
            email: `spam_${i}@example.com`,
            password: 'Password123',
          });
        responses.push(res);
      }

      // The 6th request must be blocked with 429
      const lastRes = responses[5];
      expect(lastRes.status).toBe(429);
      expect(lastRes.body.success).toBe(false);
      expect(lastRes.body.error.code).toBe('RATE_LIMITED');
    });
  });

  // 2. Notification REST Endpoints
  describe('Notification Endpoints', () => {
    beforeEach(async () => {
      // Seed notifications for emp1User
      await Notification.create([
        {
          userId: emp1User._id,
          type: NOTIFICATION_TYPES.ATTENDANCE_VALID,
          title: 'Attendance Verified',
          message: 'Your attendance was approved',
          readAt: null,
          createdAt: new Date(Date.now() - 3000),
        },
        {
          userId: emp1User._id,
          type: NOTIFICATION_TYPES.OVERTIME_APPROVED,
          title: 'Overtime Approved',
          message: 'Your overtime request was approved',
          readAt: new Date(),
          createdAt: new Date(Date.now() - 2000),
        },
        {
          userId: emp1User._id,
          type: NOTIFICATION_TYPES.MISSED_PUNCH_IN,
          title: 'Missed Punch-In Alert',
          message: 'Please punch in',
          readAt: null,
          createdAt: new Date(Date.now() - 1000),
        },
      ]);

      // Seed notification for emp2User
      await Notification.create({
        userId: emp2User._id,
        type: NOTIFICATION_TYPES.ATTENDANCE_INVALID,
        title: 'Attendance Invalid',
        message: 'Invalid selfie',
        readAt: null,
      });
    });

    it('GET /api/notifications lists paginated notifications for the authenticated user', async () => {
      const res = await request(app)
        .get('/api/notifications?page=1&limit=10')
        .set('Cookie', emp1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.meta.total).toBe(3);
    });

    it('GET /api/notifications?unreadOnly=true filters out read notifications', async () => {
      const res = await request(app)
        .get('/api/notifications?unreadOnly=true')
        .set('Cookie', emp1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.every((n) => n.readAt === null)).toBe(true);
    });

    it('GET /api/notifications/unread-count returns accurate unread count', async () => {
      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set('Cookie', emp1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.unreadCount).toBe(2);
    });

    it('PATCH /api/notifications/:id/read marks own notification as read', async () => {
      const unread = await Notification.findOne({
        userId: emp1User._id,
        readAt: null,
      });

      const res = await request(app)
        .patch(`/api/notifications/${unread._id}/read`)
        .set('Cookie', emp1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.readAt).not.toBeNull();

      const fresh = await Notification.findById(unread._id);
      expect(fresh.readAt).not.toBeNull();
    });

    it('PATCH /api/notifications/:id/read returns 404 when marking another user notification', async () => {
      const emp2Notif = await Notification.findOne({ userId: emp2User._id });

      const res = await request(app)
        .patch(`/api/notifications/${emp2Notif._id}/read`)
        .set('Cookie', emp1Cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('PATCH /api/notifications/read-all marks all unread notifications as read for caller', async () => {
      const res = await request(app)
        .patch('/api/notifications/read-all')
        .set('Cookie', emp1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.modifiedCount).toBe(2);

      const countRes = await request(app)
        .get('/api/notifications/unread-count')
        .set('Cookie', emp1Cookie);
      expect(countRes.body.data.unreadCount).toBe(0);

      // emp2User notification remains unread
      const emp2Count = await Notification.countDocuments({
        userId: emp2User._id,
        readAt: null,
      });
      expect(emp2Count).toBe(1);
    });
  });

  // 3. Notification Triggers & Jobs
  describe('Notification Triggers and Scheduled Jobs', () => {
    it('creates notification and sets recipient for verification review', async () => {
      const workDate = getWorkDate();
      const attendance = await Attendance.create({
        employeeId: emp1User._id,
        workDate,
        workingStatus: WORKING_STATUS.COMPLETED,
        workedMinutes: 490,
        punchIn: {
          at: new Date(),
          location: { latitude: 28.6, longitude: 77.2, accuracy: 10 },
        },
        punchOut: {
          at: new Date(),
          location: { latitude: 28.6, longitude: 77.2, accuracy: 10 },
        },
        verification: { status: VERIFICATION_STATUS.PENDING },
      });

      await notifyVerificationReviewed({
        attendance,
        reviewer: managerUser,
        status: 'valid',
      });

      const notif = await Notification.findOne({
        userId: emp1User._id,
        type: NOTIFICATION_TYPES.ATTENDANCE_VALID,
      });
      expect(notif).not.toBeNull();
      expect(notif.title).toBe('Attendance Verified');
      expect(notif.data.attendanceId.toString()).toBe(attendance._id.toString());
    });

    it('creates notification for manager when employee requests overtime', async () => {
      const workDate = getWorkDate();
      const attendance = await Attendance.create({
        employeeId: emp1User._id,
        workDate,
        workingStatus: WORKING_STATUS.COMPLETED,
        workedMinutes: 540,
        punchIn: {
          at: new Date(),
          location: { latitude: 28.6, longitude: 77.2, accuracy: 10 },
        },
        punchOut: {
          at: new Date(),
          location: { latitude: 28.6, longitude: 77.2, accuracy: 10 },
        },
        overtime: {
          status: OVERTIME_STATUS.PENDING,
          requestedMinutes: 60,
        },
      });

      await notifyOvertimeRequested({
        attendance,
        employee: emp1User,
        requestedMinutes: 60,
        reason: 'Client deliverable',
      });

      // Recipient is the manager
      const notif = await Notification.findOne({
        userId: managerUser._id,
        type: NOTIFICATION_TYPES.OVERTIME_REQUESTED,
      });
      expect(notif).not.toBeNull();
      expect(notif.message).toContain('60 minutes');
    });

    it('creates notification for all admins when manager requests overtime', async () => {
      const workDate = getWorkDate();
      const attendance = await Attendance.create({
        employeeId: managerUser._id,
        workDate,
        workingStatus: WORKING_STATUS.COMPLETED,
        workedMinutes: 520,
        punchIn: {
          at: new Date(),
          location: { latitude: 28.6, longitude: 77.2, accuracy: 10 },
        },
        punchOut: {
          at: new Date(),
          location: { latitude: 28.6, longitude: 77.2, accuracy: 10 },
        },
      });

      await notifyOvertimeRequested({
        attendance,
        employee: managerUser,
        requestedMinutes: 40,
        reason: 'Extra shift coverage',
      });

      const adminNotif = await Notification.findOne({
        userId: adminUser._id,
        type: NOTIFICATION_TYPES.OVERTIME_REQUESTED,
      });
      expect(adminNotif).not.toBeNull();
    });

    it('creates notification for employee when overtime is reviewed', async () => {
      const workDate = getWorkDate();
      const attendance = await Attendance.create({
        employeeId: emp1User._id,
        workDate,
        workingStatus: WORKING_STATUS.COMPLETED,
        workedMinutes: 540,
        punchIn: {
          at: new Date(),
          location: { latitude: 28.6, longitude: 77.2, accuracy: 10 },
        },
        overtime: {
          status: OVERTIME_STATUS.APPROVED,
          requestedMinutes: 60,
        },
      });

      await notifyOvertimeReviewed({
        attendance,
        reviewer: managerUser,
        decision: 'approved',
      });

      const notif = await Notification.findOne({
        userId: emp1User._id,
        type: NOTIFICATION_TYPES.OVERTIME_APPROVED,
      });
      expect(notif).not.toBeNull();
      expect(notif.title).toBe('Overtime Approved');
    });

    it('runMissedPunchInJob creates idempotent alert and does not duplicate on repeat run', async () => {
      const workDate = '2026-10-12'; // Monday (guaranteed working day)

      // Both employees have no attendance for this date
      const run1 = await runMissedPunchInJob(workDate, true);
      expect(run1.alertedCount).toBe(2);

      const countAfterFirst = await Notification.countDocuments({
        type: NOTIFICATION_TYPES.MISSED_PUNCH_IN,
        'data.workDate': workDate,
      });
      expect(countAfterFirst).toBe(2);

      // Run a second time: idempotency prevents duplicate notifications
      const run2 = await runMissedPunchInJob(workDate, true);
      expect(run2.alertedCount).toBe(0);

      const countAfterSecond = await Notification.countDocuments({
        type: NOTIFICATION_TYPES.MISSED_PUNCH_IN,
        'data.workDate': workDate,
      });
      expect(countAfterSecond).toBe(2);
    });

    it('runMissedPunchOutJob alerts open records idempotently', async () => {
      const workDate = getWorkDate();
      const att = await Attendance.create({
        employeeId: emp1User._id,
        workDate,
        workingStatus: WORKING_STATUS.IN_PROGRESS,
        punchIn: {
          at: new Date(),
          location: { latitude: 28.6, longitude: 77.2, accuracy: 10 },
        },
      });

      const run1 = await runMissedPunchOutJob(workDate);
      expect(run1.alertedCount).toBe(1);

      const notifCount1 = await Notification.countDocuments({
        type: NOTIFICATION_TYPES.MISSED_PUNCH_OUT,
        'data.attendanceId': att._id,
      });
      expect(notifCount1).toBe(1);

      // Repeat run does not duplicate
      const run2 = await runMissedPunchOutJob(workDate);
      expect(run2.alertedCount).toBe(0);

      const notifCount2 = await Notification.countDocuments({
        type: NOTIFICATION_TYPES.MISSED_PUNCH_OUT,
        'data.attendanceId': att._id,
      });
      expect(notifCount2).toBe(1);
    });

    it('runAutoCloseJob auto-closes expired records and alerts employee + manager idempotently', async () => {
      const yesterdayDate = '2026-10-08';
      const todayDate = '2026-10-09';

      const att = await Attendance.create({
        employeeId: emp1User._id,
        workDate: yesterdayDate,
        workingStatus: WORKING_STATUS.IN_PROGRESS,
        punchIn: {
          at: new Date(),
          location: { latitude: 28.6, longitude: 77.2, accuracy: 10 },
        },
      });

      const run1 = await runAutoCloseJob(todayDate);
      expect(run1.closedCount).toBe(1);

      const updatedAtt = await Attendance.findById(att._id);
      expect(updatedAtt.workingStatus).toBe(WORKING_STATUS.MISSED);
      expect(updatedAtt.workedMinutes).toBe(0);
      expect(updatedAtt.closedBy).toBe('system');

      // Both employee and manager should receive the notification
      const empNotif = await Notification.findOne({
        userId: emp1User._id,
        type: NOTIFICATION_TYPES.ATTENDANCE_AUTO_CLOSED,
        'data.attendanceId': att._id,
      });
      expect(empNotif).not.toBeNull();

      const mgrNotif = await Notification.findOne({
        userId: managerUser._id,
        type: NOTIFICATION_TYPES.ATTENDANCE_AUTO_CLOSED,
        'data.attendanceId': att._id,
      });
      expect(mgrNotif).not.toBeNull();

      // Second run does not re-close or duplicate
      const run2 = await runAutoCloseJob(todayDate);
      expect(run2.closedCount).toBe(0);

      const totalNotifs = await Notification.countDocuments({
        type: NOTIFICATION_TYPES.ATTENDANCE_AUTO_CLOSED,
        'data.attendanceId': att._id,
      });
      expect(totalNotifs).toBe(2);
    });
  });

  // 4. Socket.IO Realtime Connection & Room Targeting
  describe('Socket.IO Realtime Communication', () => {
    let emp1SocketToken;
    let adminSocketToken;

    beforeEach(async () => {
      const tokenResE1 = await request(app)
        .get('/api/auth/socket-token')
        .set('Cookie', emp1Cookie);
      emp1SocketToken = tokenResE1.body.data.socketToken;

      const tokenResA = await request(app)
        .get('/api/auth/socket-token')
        .set('Cookie', adminCookie);
      adminSocketToken = tokenResA.body.data.socketToken;
    });

    it('authenticates socket connection with valid socket token', async () => {
      const socket = Client(`http://localhost:${serverPort}`, {
        auth: { token: emp1SocketToken },
        transports: ['websocket'],
      });

      await new Promise((resolve, reject) => {
        socket.on('connect', resolve);
        socket.on('connect_error', reject);
      });

      expect(socket.connected).toBe(true);
      socket.disconnect();
    });

    it('rejects socket connection without token or with invalid purpose', async () => {
      // Connect without token
      const noTokenSocket = Client(`http://localhost:${serverPort}`, {
        auth: {},
        transports: ['websocket'],
      });

      const err1 = await new Promise((resolve) => {
        noTokenSocket.on('connect_error', (err) => resolve(err.message));
      });
      expect(err1).toContain('Authentication token required');
      noTokenSocket.disconnect();

      // Connect with session token (purpose === 'session', not 'socket')
      // Extract session jwt from cookie
      const sessionJwt = emp1Cookie[0].split('token=')[1].split(';')[0];
      const badPurposeSocket = Client(`http://localhost:${serverPort}`, {
        auth: { token: sessionJwt },
        transports: ['websocket'],
      });

      const err2 = await new Promise((resolve) => {
        badPurposeSocket.on('connect_error', (err) => resolve(err.message));
      });
      expect(err2).toContain('Invalid token purpose');
      badPurposeSocket.disconnect();
    });

    it('rejects connection if user is inactive', async () => {
      emp1User.isActive = false;
      await emp1User.save();

      const socket = Client(`http://localhost:${serverPort}`, {
        auth: { token: emp1SocketToken },
        transports: ['websocket'],
      });

      const err = await new Promise((resolve) => {
        socket.on('connect_error', (error) => resolve(error.message));
      });
      expect(err).toContain('Account is inactive');
      socket.disconnect();

      // Restore
      emp1User.isActive = true;
      await emp1User.save();
    });

    it('delivers notification:new only to the designated recipient room', async () => {
      const emp1Socket = Client(`http://localhost:${serverPort}`, {
        auth: { token: emp1SocketToken },
        transports: ['websocket'],
      });

      const tokenResE2 = await request(app)
        .get('/api/auth/socket-token')
        .set('Cookie', emp2Cookie);
      const emp2SocketToken = tokenResE2.body.data.socketToken;

      const emp2Socket = Client(`http://localhost:${serverPort}`, {
        auth: { token: emp2SocketToken },
        transports: ['websocket'],
      });

      await Promise.all([
        new Promise((resolve) => emp1Socket.on('connect', resolve)),
        new Promise((resolve) => emp2Socket.on('connect', resolve)),
      ]);

      const emp1Received = [];
      const emp2Received = [];

      emp1Socket.on('notification:new', (data) => emp1Received.push(data));
      emp2Socket.on('notification:new', (data) => emp2Received.push(data));

      // Emit notification targeted exclusively to emp1User
      const fakeNotification = {
        _id: '670000000000000000000001',
        title: 'Targeted Alert',
      };
      emitNotification(emp1User._id, fakeNotification);

      // Wait a moment for network delivery
      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(emp1Received).toHaveLength(1);
      expect(emp1Received[0].notification.title).toBe('Targeted Alert');
      expect(emp2Received).toHaveLength(0); // emp2User did not receive it!

      emp1Socket.disconnect();
      emp2Socket.disconnect();
    });

    it('delivers attendance:updated to employee, manager and admin room', async () => {
      const emp1Socket = Client(`http://localhost:${serverPort}`, {
        auth: { token: emp1SocketToken },
        transports: ['websocket'],
      });

      const adminSocket = Client(`http://localhost:${serverPort}`, {
        auth: { token: adminSocketToken },
        transports: ['websocket'],
      });

      const tokenResE2 = await request(app)
        .get('/api/auth/socket-token')
        .set('Cookie', emp2Cookie);
      const emp2Socket = Client(`http://localhost:${serverPort}`, {
        auth: { token: tokenResE2.body.data.socketToken },
        transports: ['websocket'],
      });

      await Promise.all([
        new Promise((resolve) => emp1Socket.on('connect', resolve)),
        new Promise((resolve) => adminSocket.on('connect', resolve)),
        new Promise((resolve) => emp2Socket.on('connect', resolve)),
      ]);

      const emp1Updates = [];
      const adminUpdates = [];
      const emp2Updates = [];

      emp1Socket.on('attendance:updated', (data) => emp1Updates.push(data));
      adminSocket.on('attendance:updated', (data) => adminUpdates.push(data));
      emp2Socket.on('attendance:updated', (data) => emp2Updates.push(data));

      const attId = '670000000000000000000099';
      emitAttendanceUpdated(attId, emp1User._id, managerUser._id);

      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(emp1Updates).toHaveLength(1);
      expect(emp1Updates[0].attendanceId).toBe(attId);

      expect(adminUpdates).toHaveLength(1);
      expect(adminUpdates[0].attendanceId).toBe(attId);

      // emp2 is neither employee nor manager for this attendance
      expect(emp2Updates).toHaveLength(0);

      emp1Socket.disconnect();
      adminSocket.disconnect();
      emp2Socket.disconnect();
    });
  });

  // 5. Complete CLAUDE.md Section 9 Endpoint Audit
  describe('Route Audit — All 32 CLAUDE.md Section 9 Endpoints Mounted', () => {
    const endpoints = [
      { method: 'get', url: '/api/health' },
      { method: 'post', url: '/api/auth/signup' },
      { method: 'post', url: '/api/auth/login' },
      { method: 'post', url: '/api/auth/logout' },
      { method: 'get', url: '/api/auth/me' },
      { method: 'get', url: '/api/auth/socket-token' },

      { method: 'get', url: '/api/users' },
      { method: 'get', url: '/api/users/team' },
      { method: 'get', url: '/api/users/managers' },
      { method: 'get', url: '/api/users/000000000000000000000000' },
      { method: 'patch', url: '/api/users/000000000000000000000000' },

      { method: 'get', url: '/api/attendance/today' },
      { method: 'get', url: '/api/attendance/me' },
      { method: 'get', url: '/api/attendance/team' },
      { method: 'get', url: '/api/attendance' },
      { method: 'get', url: '/api/attendance/000000000000000000000000' },
      { method: 'post', url: '/api/attendance/punch-in' },
      { method: 'post', url: '/api/attendance/punch-out' },
      { method: 'get', url: '/api/attendance/000000000000000000000000/selfies/punch-in' },
      { method: 'patch', url: '/api/attendance/000000000000000000000000/verification' },
      { method: 'post', url: '/api/attendance/000000000000000000000000/overtime' },
      { method: 'patch', url: '/api/attendance/000000000000000000000000/overtime/review' },
      { method: 'get', url: '/api/overtime/pending' },

      { method: 'get', url: '/api/reports/daily' },
      { method: 'get', url: '/api/reports/daily/export' },
      { method: 'get', url: '/api/dashboard/summary' },
      { method: 'get', url: '/api/settings/geofence' },
      { method: 'put', url: '/api/settings/geofence' },
      { method: 'get', url: '/api/notifications' },
      { method: 'get', url: '/api/notifications/unread-count' },
      { method: 'patch', url: '/api/notifications/000000000000000000000000/read' },
      { method: 'patch', url: '/api/notifications/read-all' },
    ];

    it('verifies exact count of 32 endpoints in audit', () => {
      expect(endpoints).toHaveLength(32);
    });

    it.each(endpoints)(
      '$method.toUpperCase() $url is mounted and handled',
      async ({ method, url }) => {
        const res = await request(app)[method](url);
        if (res.status === 404) {
          expect(res.body?.error?.message).not.toContain('not found on this server');
        }
      }
    );
  });
});

