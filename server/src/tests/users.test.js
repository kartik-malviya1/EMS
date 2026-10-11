import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { User } from '../models/user.model.js';
import { ROLES } from '../config/constants.js';
import { updateUser as updateUserService } from '../services/user.service.js';

describe('User Management Endpoints & Rules', () => {
  let admin1;
  let admin2;
  let manager1;
  let manager2;
  let employee1;
  let employee2;

  let admin1Cookie;
  let manager1Cookie;
  let employee1Cookie;

  beforeEach(async () => {
    const passwordHash = await User.hashPassword('Password123');

    admin1 = await User.create({
      name: 'Primary Admin',
      email: 'admin1@users.com',
      passwordHash,
      role: ROLES.ADMIN,
      isActive: true,
    });

    admin2 = await User.create({
      name: 'Secondary Admin',
      email: 'admin2@users.com',
      passwordHash,
      role: ROLES.ADMIN,
      isActive: true,
    });

    manager1 = await User.create({
      name: 'Manager One',
      email: 'manager1@users.com',
      passwordHash,
      role: ROLES.MANAGER,
      isActive: true,
    });

    manager2 = await User.create({
      name: 'Manager Two',
      email: 'manager2@users.com',
      passwordHash,
      role: ROLES.MANAGER,
      isActive: true,
    });

    employee1 = await User.create({
      name: 'Employee One',
      email: 'employee1@users.com',
      passwordHash,
      role: ROLES.EMPLOYEE,
      managerId: manager1._id,
      isActive: true,
    });

    employee2 = await User.create({
      name: 'Employee Two',
      email: 'employee2@users.com',
      passwordHash,
      role: ROLES.EMPLOYEE,
      managerId: manager2._id,
      isActive: true,
    });

    // Obtain session cookies
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin1@users.com',
      password: 'Password123',
    });
    admin1Cookie = adminLogin.headers['set-cookie'];

    const managerLogin = await request(app).post('/api/auth/login').send({
      email: 'manager1@users.com',
      password: 'Password123',
    });
    manager1Cookie = managerLogin.headers['set-cookie'];

    const employeeLogin = await request(app).post('/api/auth/login').send({
      email: 'employee1@users.com',
      password: 'Password123',
    });
    employee1Cookie = employeeLogin.headers['set-cookie'];
  });

  describe('RBAC & Access Control', () => {
    it('restricts GET /api/users to admin only', async () => {
      // Unauthenticated
      let res = await request(app).get('/api/users');
      expect(res.status).toBe(401);

      // Employee
      res = await request(app).get('/api/users').set('Cookie', employee1Cookie);
      expect(res.status).toBe(403);

      // Manager
      res = await request(app).get('/api/users').set('Cookie', manager1Cookie);
      expect(res.status).toBe(403);

      // Admin
      res = await request(app).get('/api/users').set('Cookie', admin1Cookie);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('restricts GET /api/users/team to managers only', async () => {
      // Employee
      let res = await request(app).get('/api/users/team').set('Cookie', employee1Cookie);
      expect(res.status).toBe(403);

      // Admin (team route is manager-specific)
      res = await request(app).get('/api/users/team').set('Cookie', admin1Cookie);
      expect(res.status).toBe(403);

      // Manager
      res = await request(app).get('/api/users/team').set('Cookie', manager1Cookie);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].email).toBe('employee1@users.com');
    });

    it('returns only active managers on GET /api/users/managers for admin', async () => {
      await User.create({
        name: 'Inactive Mgr',
        email: 'inactive.mgr@users.com',
        passwordHash: 'dummy',
        role: ROLES.MANAGER,
        isActive: false,
      });

      const res = await request(app)
        .get('/api/users/managers')
        .set('Cookie', admin1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const emails = res.body.data.map((m) => m.email);
      expect(emails).toContain('manager1@users.com');
      expect(emails).toContain('manager2@users.com');
      expect(emails).not.toContain('inactive.mgr@users.com');
    });
  });

  describe('Listing Filters & Pagination', () => {
    it('filters users by role and search string with pagination meta', async () => {
      const res = await request(app)
        .get('/api/users?role=employee&search=employee1&page=1&limit=10')
        .set('Cookie', admin1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].email).toBe('employee1@users.com');
      expect(res.body.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe('Admin PATCH /api/users/:id Rules', () => {
    it('prevents admin from changing own role', async () => {
      const res = await request(app)
        .patch(`/api/users/${admin1._id}`)
        .set('Cookie', admin1Cookie)
        .send({ role: ROLES.MANAGER });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CANNOT_CHANGE_OWN_ROLE');
    });

    it('prevents admin from deactivating self', async () => {
      const res = await request(app)
        .patch(`/api/users/${admin1._id}`)
        .set('Cookie', admin1Cookie)
        .send({ isActive: false });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CANNOT_DEACTIVATE_SELF');
    });

    it('prevents deactivating or demoting the last active admin', async () => {
      // With 2 active admins (admin1 and admin2), admin1 deactivating admin2 succeeds
      const resDeact2 = await request(app)
        .patch(`/api/users/${admin2._id}`)
        .set('Cookie', admin1Cookie)
        .send({ isActive: false });
      expect(resDeact2.status).toBe(200);

      // Now only 1 active admin (admin1) remains in the system
      const activeCount = await User.countDocuments({ role: ROLES.ADMIN, isActive: true });
      expect(activeCount).toBe(1);

      // Attempting to deactivate the last remaining admin throws 409 CANNOT_MODIFY_LAST_ADMIN
      let caughtError;
      try {
        await updateUserService(admin2, admin1._id, { isActive: false });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeDefined();
      expect(caughtError.statusCode).toBe(409);
      expect(caughtError.code).toBe('CANNOT_MODIFY_LAST_ADMIN');
    });

    it('returns 409 HAS_TEAM_MEMBERS when demoting or deactivating a manager with active team members', async () => {
      // manager1 has employee1 as an active team member
      const resDemote = await request(app)
        .patch(`/api/users/${manager1._id}`)
        .set('Cookie', admin1Cookie)
        .send({ role: ROLES.EMPLOYEE });

      expect(resDemote.status).toBe(409);
      expect(resDemote.body.error.code).toBe('HAS_TEAM_MEMBERS');

      const resDeact = await request(app)
        .patch(`/api/users/${manager1._id}`)
        .set('Cookie', admin1Cookie)
        .send({ isActive: false });

      expect(resDeact.status).toBe(409);
      expect(resDeact.body.error.code).toBe('HAS_TEAM_MEMBERS');
    });

    it('forces managerId = null when role is changed to manager or admin', async () => {
      // employee2 has managerId set to manager2
      const res = await request(app)
        .patch(`/api/users/${employee2._id}`)
        .set('Cookie', admin1Cookie)
        .send({ role: ROLES.MANAGER });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe(ROLES.MANAGER);
      expect(res.body.data.managerId).toBeNull();
    });

    it('validates managerId assignment rules', async () => {
      // User cannot be their own manager
      const resSelfMgr = await request(app)
        .patch(`/api/users/${employee1._id}`)
        .set('Cookie', admin1Cookie)
        .send({ managerId: employee1._id.toString() });

      expect(resSelfMgr.status).toBe(400);

      // managerId must reference an active manager (cannot reference an employee)
      const resEmpAsMgr = await request(app)
        .patch(`/api/users/${employee1._id}`)
        .set('Cookie', admin1Cookie)
        .send({ managerId: employee2._id.toString() });

      expect(resEmpAsMgr.status).toBe(400);
      expect(resEmpAsMgr.body.error.code).toBe('INVALID_MANAGER');

      // Valid reassignment to manager2 succeeds
      const resValid = await request(app)
        .patch(`/api/users/${employee1._id}`)
        .set('Cookie', admin1Cookie)
        .send({ managerId: manager2._id.toString() });

      expect(resValid.status).toBe(200);
      expect(resValid.body.data.managerId._id.toString()).toBe(manager2._id.toString());
    });

    it('ensures deactivation takes effect immediately on an existing active session', async () => {
      // employee1 currently has an active session (employee1Cookie)
      let meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', employee1Cookie);
      expect(meRes.status).toBe(200);

      // Admin deactivates employee1
      const deactRes = await request(app)
        .patch(`/api/users/${employee1._id}`)
        .set('Cookie', admin1Cookie)
        .send({ isActive: false });
      expect(deactRes.status).toBe(200);
      expect(deactRes.body.data.isActive).toBe(false);

      // employee1 immediately receives 403 ACCOUNT_INACTIVE on their existing session
      meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', employee1Cookie);
      expect(meRes.status).toBe(403);
      expect(meRes.body.error.code).toBe('ACCOUNT_INACTIVE');
    });
  });
});
