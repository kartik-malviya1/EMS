import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { User } from '../models/user.model.js';
import { Attendance } from '../models/attendance.model.js';
import { ROLES, WORKING_STATUS } from '../config/constants.js';

describe('Attendance & Selfie Endpoints', () => {
  let employee1;
  let employee2;
  let manager1;
  let admin1;

  let emp1Cookie;
  let emp2Cookie;
  let mgr1Cookie;
  let adminCookie;

  // 12-byte valid JPEG buffer
  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);

  beforeEach(async () => {
    const passwordHash = await User.hashPassword('Password123');

    admin1 = await User.create({
      name: 'Admin Boss',
      email: 'admin.att@example.com',
      passwordHash,
      role: ROLES.ADMIN,
    });

    manager1 = await User.create({
      name: 'Manager Mike',
      email: 'manager.att@example.com',
      passwordHash,
      role: ROLES.MANAGER,
    });

    employee1 = await User.create({
      name: 'Emp Alice',
      email: 'emp1.att@example.com',
      passwordHash,
      role: ROLES.EMPLOYEE,
      managerId: manager1._id,
    });

    employee2 = await User.create({
      name: 'Emp Bob',
      email: 'emp2.att@example.com',
      passwordHash,
      role: ROLES.EMPLOYEE,
      managerId: null,
    });

    // Login cookies
    const loginEmp1 = await request(app).post('/api/auth/login').send({
      email: 'emp1.att@example.com',
      password: 'Password123',
    });
    emp1Cookie = loginEmp1.headers['set-cookie'];

    const loginEmp2 = await request(app).post('/api/auth/login').send({
      email: 'emp2.att@example.com',
      password: 'Password123',
    });
    emp2Cookie = loginEmp2.headers['set-cookie'];

    const loginMgr1 = await request(app).post('/api/auth/login').send({
      email: 'manager.att@example.com',
      password: 'Password123',
    });
    mgr1Cookie = loginMgr1.headers['set-cookie'];

    const loginAdmin = await request(app).post('/api/auth/login').send({
      email: 'admin.att@example.com',
      password: 'Password123',
    });
    adminCookie = loginAdmin.headers['set-cookie'];
  });

  describe('GET /api/attendance/today', () => {
    it('returns null before punch in', async () => {
      expect(employee1._id).toBeDefined();
      const res = await request(app)
        .get('/api/attendance/today')
        .set('Cookie', emp1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeNull();
    });
  });

  describe('POST /api/attendance/punch-in', () => {
    it('creates attendance record with server timestamps and returns 201', async () => {
      const res = await request(app)
        .post('/api/attendance/punch-in')
        .set('Cookie', emp1Cookie)
        .field('latitude', '28.6139')
        .field('longitude', '77.2090')
        .field('accuracy', '10')
        .attach('selfie', validJpegBuffer, 'selfie.jpg');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.workingStatus).toBe(WORKING_STATUS.IN_PROGRESS);
      expect(res.body.data.punchIn).toBeDefined();
      expect(res.body.data.punchIn.selfie.publicId).toBeUndefined(); // private, never returned

      // Today endpoint now returns this record
      const todayRes = await request(app)
        .get('/api/attendance/today')
        .set('Cookie', emp1Cookie);
      expect(todayRes.status).toBe(200);
      expect(todayRes.body.data._id).toBe(res.body.data._id);
    });

    it('rejects duplicate punch-in on same day with 409 ALREADY_PUNCHED_IN', async () => {
      // First punch in
      await request(app)
        .post('/api/attendance/punch-in')
        .set('Cookie', emp1Cookie)
        .field('latitude', '28.6139')
        .field('longitude', '77.2090')
        .field('accuracy', '10')
        .attach('selfie', validJpegBuffer, 'selfie.jpg');

      // Duplicate punch in
      const res = await request(app)
        .post('/api/attendance/punch-in')
        .set('Cookie', emp1Cookie)
        .field('latitude', '28.6139')
        .field('longitude', '77.2090')
        .field('accuracy', '10')
        .attach('selfie', validJpegBuffer, 'selfie.jpg');

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_PUNCHED_IN');
    });

    it('rejects missing selfie image with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/attendance/punch-in')
        .set('Cookie', emp1Cookie)
        .field('latitude', '28.6139')
        .field('longitude', '77.2090')
        .field('accuracy', '10');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid coordinates with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/attendance/punch-in')
        .set('Cookie', emp1Cookie)
        .field('latitude', '120.0') // > 90
        .field('longitude', '77.2090')
        .field('accuracy', '10')
        .attach('selfie', validJpegBuffer, 'selfie.jpg');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects bad magic bytes disguised as image with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const fakeText = Buffer.from('Plain text file masquerading as a JPEG');
      const res = await request(app)
        .post('/api/attendance/punch-in')
        .set('Cookie', emp1Cookie)
        .field('latitude', '28.6139')
        .field('longitude', '77.2090')
        .field('accuracy', '10')
        .attach('selfie', fakeText, 'selfie.jpg');

      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects oversize selfie (> 2MB) with 413 FILE_TOO_LARGE', async () => {
      const bigBuffer = Buffer.alloc(2.5 * 1024 * 1024);
      // Valid JPEG header on oversize buffer
      bigBuffer[0] = 0xff;
      bigBuffer[1] = 0xd8;
      bigBuffer[2] = 0xff;

      const res = await request(app)
        .post('/api/attendance/punch-in')
        .set('Cookie', emp1Cookie)
        .field('latitude', '28.6139')
        .field('longitude', '77.2090')
        .field('accuracy', '10')
        .attach('selfie', bigBuffer, 'big.jpg');

      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('POST /api/attendance/punch-out', () => {
    it('returns 409 NO_OPEN_ATTENDANCE when punching out without punch-in', async () => {
      const res = await request(app)
        .post('/api/attendance/punch-out')
        .set('Cookie', emp1Cookie)
        .field('latitude', '28.6139')
        .field('longitude', '77.2090')
        .field('accuracy', '10')
        .attach('selfie', validJpegBuffer, 'selfie.jpg');

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('NO_OPEN_ATTENDANCE');
    });

    it('punches out successfully and calculates working status', async () => {
      // 1. Punch in
      await request(app)
        .post('/api/attendance/punch-in')
        .set('Cookie', emp1Cookie)
        .field('latitude', '28.6139')
        .field('longitude', '77.2090')
        .field('accuracy', '10')
        .attach('selfie', validJpegBuffer, 'selfie.jpg');

      // 2. Punch out
      const outRes = await request(app)
        .post('/api/attendance/punch-out')
        .set('Cookie', emp1Cookie)
        .field('latitude', '28.6139')
        .field('longitude', '77.2090')
        .field('accuracy', '10')
        .attach('selfie', validJpegBuffer, 'selfie.jpg');

      expect(outRes.status).toBe(200);
      expect(outRes.body.success).toBe(true);
      expect(outRes.body.data.punchOut).toBeDefined();
      expect(outRes.body.data.workingStatus).toBe(WORKING_STATUS.INCOMPLETE); // 0 worked minutes
      expect(outRes.body.data.closedBy).toBe('employee');

      // 3. Duplicate punch out returns 409
      const dupRes = await request(app)
        .post('/api/attendance/punch-out')
        .set('Cookie', emp1Cookie)
        .field('latitude', '28.6139')
        .field('longitude', '77.2090')
        .field('accuracy', '10')
        .attach('selfie', validJpegBuffer, 'selfie.jpg');

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.error.code).toBe('NO_OPEN_ATTENDANCE');
    });
  });

  describe('Concurrency Guarantees', () => {
    it('concurrent Promise.all of 10 punch-ins yields exactly one record and 9 conflicts', async () => {
      const calls = Array.from({ length: 10 }).map(() =>
        request(app)
          .post('/api/attendance/punch-in')
          .set('Cookie', emp2Cookie)
          .field('latitude', '28.6139')
          .field('longitude', '77.2090')
          .field('accuracy', '10')
          .attach('selfie', validJpegBuffer, 'selfie.jpg')
      );

      const results = await Promise.all(calls);
      const successes = results.filter((r) => r.status === 201);
      const conflicts = results.filter((r) => r.status === 409);

      expect(successes.length).toBe(1);
      expect(conflicts.length).toBe(9);
      conflicts.forEach((c) => expect(c.body.error.code).toBe('ALREADY_PUNCHED_IN'));

      // Check DB count
      const count = await Attendance.countDocuments({ employeeId: employee2._id });
      expect(count).toBe(1);
    });

    it('concurrent punch-outs yield exactly one success and others 409', async () => {
      // First ensure open punch in
      await request(app)
        .post('/api/attendance/punch-in')
        .set('Cookie', emp1Cookie)
        .field('latitude', '28.6139')
        .field('longitude', '77.2090')
        .field('accuracy', '10')
        .attach('selfie', validJpegBuffer, 'selfie.jpg');

      // 5 concurrent punch-outs
      const calls = Array.from({ length: 5 }).map(() =>
        request(app)
          .post('/api/attendance/punch-out')
          .set('Cookie', emp1Cookie)
          .field('latitude', '28.6139')
          .field('longitude', '77.2090')
          .field('accuracy', '10')
          .attach('selfie', validJpegBuffer, 'selfie.jpg')
      );

      const results = await Promise.all(calls);
      const successes = results.filter((r) => r.status === 200);
      const conflicts = results.filter((r) => r.status === 409);

      expect(successes.length).toBe(1);
      expect(conflicts.length).toBe(4);
    });
  });

  describe('Selfie Streaming & Scope Security (GET /api/attendance/:id/selfies/:kind)', () => {
    let attendanceId;

    beforeEach(async () => {
      const punchRes = await request(app)
        .post('/api/attendance/punch-in')
        .set('Cookie', emp1Cookie)
        .field('latitude', '28.6139')
        .field('longitude', '77.2090')
        .field('accuracy', '10')
        .attach('selfie', validJpegBuffer, 'selfie.jpg');

      attendanceId = punchRes.body.data._id;
    });

    it('streams selfie to record owner with proper Cache-Control header', async () => {
      const res = await request(app)
        .get(`/api/attendance/${attendanceId}/selfies/punch-in`)
        .set('Cookie', emp1Cookie);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/jpeg');
      expect(res.headers['cache-control']).toBe('private, max-age=300');
      expect(res.body).toBeInstanceOf(Buffer);
    });

    it('streams selfie to in-scope manager', async () => {
      const res = await request(app)
        .get(`/api/attendance/${attendanceId}/selfies/punch-in`)
        .set('Cookie', mgr1Cookie);

      expect(res.status).toBe(200);
    });

    it('streams selfie to admin', async () => {
      expect(admin1._id).toBeDefined();
      const res = await request(app)
        .get(`/api/attendance/${attendanceId}/selfies/punch-in`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
    });

    it('returns 404 NOT_FOUND to out-of-scope employee to avoid revealing existence', async () => {
      const res = await request(app)
        .get(`/api/attendance/${attendanceId}/selfies/punch-in`)
        .set('Cookie', emp2Cookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
