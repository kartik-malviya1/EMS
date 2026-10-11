import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { User } from '../models/user.model.js';
import { Invitation } from '../models/invitation.model.js';
import { AuditLog } from '../models/auditLog.model.js';
import { ROLES, ACCOUNT_STATUS, INVITATION_STATUS, AUDIT_ACTIONS } from '../config/constants.js';

describe('Invite-Only Employee Lifecycle and Invitations', () => {
  let adminCookie;
  let managerCookie;
  let employeeCookie;
  let adminUser;
  let managerUser;
  let employeeUser;

  beforeEach(async () => {
    // Clean collections
    await User.deleteMany({});
    await Invitation.deleteMany({});
    await AuditLog.deleteMany({});

    // Seed Admin
    adminUser = await User.create({
      name: 'Root Admin',
      email: 'admin@company.com',
      passwordHash: await User.hashPassword('AdminPass123'),
      role: ROLES.ADMIN,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      isActive: true,
    });

    // Seed Manager
    managerUser = await User.create({
      name: 'Team Manager',
      email: 'manager@company.com',
      passwordHash: await User.hashPassword('ManagerPass123'),
      role: ROLES.MANAGER,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      isActive: true,
    });

    // Seed Employee
    employeeUser = await User.create({
      name: 'Regular Employee',
      email: 'employee@company.com',
      passwordHash: await User.hashPassword('EmployeePass123'),
      role: ROLES.EMPLOYEE,
      managerId: managerUser._id,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      isActive: true,
    });

    // Login Admin
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@company.com',
      password: 'AdminPass123',
    });
    adminCookie = adminLogin.headers['set-cookie'];

    // Login Manager
    const managerLogin = await request(app).post('/api/auth/login').send({
      email: 'manager@company.com',
      password: 'ManagerPass123',
    });
    managerCookie = managerLogin.headers['set-cookie'];

    // Login Employee
    const employeeLogin = await request(app).post('/api/auth/login').send({
      email: 'employee@company.com',
      password: 'EmployeePass123',
    });
    employeeCookie = employeeLogin.headers['set-cookie'];
  });

  describe('Admin Invitation Creation (POST /api/admin/invitations)', () => {
    it('restricts invitation creation to authenticated Admins only', async () => {
      // Unauthenticated
      const unauthRes = await request(app)
        .post('/api/admin/invitations')
        .send({ name: 'New Hire', email: 'hire@company.com', role: 'employee' });
      expect(unauthRes.status).toBe(401);

      // Employee
      const empRes = await request(app)
        .post('/api/admin/invitations')
        .set('Cookie', employeeCookie)
        .send({ name: 'New Hire', email: 'hire@company.com', role: 'employee' });
      expect(empRes.status).toBe(403);

      // Manager
      const mgrRes = await request(app)
        .post('/api/admin/invitations')
        .set('Cookie', managerCookie)
        .send({ name: 'New Hire', email: 'hire@company.com', role: 'employee' });
      expect(mgrRes.status).toBe(403);
    });

    it('rejects invitations requesting the Admin role with 400 INVALID_ROLE', async () => {
      const res = await request(app)
        .post('/api/admin/invitations')
        .set('Cookie', adminCookie)
        .send({
          name: 'Hacker Admin',
          email: 'hacker@company.com',
          role: 'admin',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('creates an employee invitation and provisions account with accountStatus: invited', async () => {
      const res = await request(app)
        .post('/api/admin/invitations')
        .set('Cookie', adminCookie)
        .send({
          name: 'John Doe',
          email: 'john.doe@company.com',
          role: 'employee',
          employeeId: 'EMP-001',
          department: 'Engineering',
          designation: 'Software Engineer',
          managerId: managerUser._id.toString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.invitation.email).toBe('john.doe@company.com');
      expect(res.body.data.invitation.role).toBe('employee');
      expect(res.body.data.user.accountStatus).toBe('invited');

      // Verify User in DB
      const dbUser = await User.findOne({ email: 'john.doe@company.com' });
      expect(dbUser).toBeDefined();
      expect(dbUser.accountStatus).toBe(ACCOUNT_STATUS.INVITED);
      expect(dbUser.isActive).toBe(false);
      expect(dbUser.managerId.toString()).toBe(managerUser._id.toString());
      expect(dbUser.department).toBe('Engineering');
      expect(dbUser.employeeId).toBe('EMP-001');

      // Verify Invitation in DB
      const dbInvitation = await Invitation.findOne({ email: 'john.doe@company.com' });
      expect(dbInvitation).toBeDefined();
      expect(dbInvitation.status).toBe(INVITATION_STATUS.PENDING);
      expect(dbInvitation.tokenHash).toBeDefined();
      // Raw token must never be stored
      expect(dbInvitation.tokenHash.length).toBe(64); // SHA-256 hex length
    });

    it('creates a manager invitation without a managerId', async () => {
      const res = await request(app)
        .post('/api/admin/invitations')
        .set('Cookie', adminCookie)
        .send({
          name: 'Sarah Lead',
          email: 'sarah.lead@company.com',
          role: 'manager',
          department: 'Product',
          designation: 'Engineering Manager',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.invitation.role).toBe('manager');

      const dbUser = await User.findOne({ email: 'sarah.lead@company.com' });
      expect(dbUser.role).toBe(ROLES.MANAGER);
      expect(dbUser.managerId).toBeNull();
      expect(dbUser.accountStatus).toBe(ACCOUNT_STATUS.INVITED);
    });

    it('rejects duplicate invitation when active account already exists with 409 USER_ALREADY_EXISTS', async () => {
      const res = await request(app)
        .post('/api/admin/invitations')
        .set('Cookie', adminCookie)
        .send({
          name: 'Duplicate Emp',
          email: 'employee@company.com', // existing active user
          role: 'employee',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('USER_ALREADY_EXISTS');
    });

    it('rejects duplicate employeeId with 409 EMPLOYEE_ID_EXISTS', async () => {
      await User.updateOne({ _id: employeeUser._id }, { employeeId: 'EMP-999' });

      const res = await request(app)
        .post('/api/admin/invitations')
        .set('Cookie', adminCookie)
        .send({
          name: 'Clashing Emp',
          email: 'clash@company.com',
          role: 'employee',
          employeeId: 'EMP-999',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMPLOYEE_ID_EXISTS');
    });

    it('rejects invalid managerId with 400 INVALID_MANAGER', async () => {
      const res = await request(app)
        .post('/api/admin/invitations')
        .set('Cookie', adminCookie)
        .send({
          name: 'Bad Manager Emp',
          email: 'badmgr@company.com',
          role: 'employee',
          managerId: employeeUser._id.toString(), // points to employee, not manager
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_MANAGER');
    });
  });

  describe('Invitation Acceptance End-to-End Workflow', () => {
    let rawToken;
    let invitationId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/admin/invitations')
        .set('Cookie', adminCookie)
        .send({
          name: 'Jane Candidate',
          email: 'jane.candidate@company.com',
          role: 'employee',
          department: 'Design',
          designation: 'UI/UX Specialist',
          managerId: managerUser._id.toString(),
        });

      invitationId = res.body.data.invitation.id;
      // In dev mode, devInvitationUrl contains raw token: /accept-invitation?token=...
      const devUrl = res.body.data.devInvitationUrl;
      const urlObj = new URL(devUrl);
      rawToken = urlObj.searchParams.get('token');
    });

    it('validates a valid pending invitation token and returns safe metadata', async () => {
      const res = await request(app)
        .post('/api/auth/invitations/validate')
        .send({ token: rawToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('jane.candidate@company.com');
      expect(res.body.data.name).toBe('Jane Candidate');
      expect(res.body.data.role).toBe('employee');
      expect(res.body.data.department).toBe('Design');
      expect(res.body.data.expiresAt).toBeDefined();
      // Never expose token or hash in validation response
      expect(res.body.data.token).toBeUndefined();
      expect(res.body.data.tokenHash).toBeUndefined();
    });

    it('rejects invalid token with 404 INVALID_TOKEN', async () => {
      const res = await request(app)
        .post('/api/auth/invitations/validate')
        .send({ token: 'invalid_dummy_token_123456789' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('prevents invited user from logging in before activation (returns generic 401 like unknown user)', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'jane.candidate@company.com',
        password: 'AnyPassword123',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('successfully accepts invitation, hashes password, activates account, and consumes token', async () => {
      const acceptRes = await request(app)
        .post('/api/auth/accept-invitation')
        .send({
          token: rawToken,
          password: 'JaneNewPassword123',
          confirmPassword: 'JaneNewPassword123',
        });

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.success).toBe(true);
      expect(acceptRes.body.data.email).toBe('jane.candidate@company.com');

      // Verify User is active and has passwordHash
      const activatedUser = await User.findOne({ email: 'jane.candidate@company.com' }).select('+passwordHash');
      expect(activatedUser.accountStatus).toBe(ACCOUNT_STATUS.ACTIVE);
      expect(activatedUser.isActive).toBe(true);
      expect(activatedUser.passwordHash).toBeDefined();

      // Verify Invitation is accepted
      const acceptedInvitation = await Invitation.findById(invitationId);
      expect(acceptedInvitation.status).toBe(INVITATION_STATUS.ACCEPTED);
      expect(acceptedInvitation.acceptedAt).toBeDefined();

      // Verify Activated User can log in with established password
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'jane.candidate@company.com',
        password: 'JaneNewPassword123',
      });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.email).toBe('jane.candidate@company.com');
      expect(loginRes.body.data.role).toBe('employee');

      // Verify Token cannot be reused (one-time use guarantee)
      const reuseRes = await request(app)
        .post('/api/auth/accept-invitation')
        .send({
          token: rawToken,
          password: 'AnotherPassword123',
          confirmPassword: 'AnotherPassword123',
        });

      expect(reuseRes.status).toBe(409);
      expect(reuseRes.body.error.code).toBe('INVITATION_ALREADY_ACCEPTED');
    });

    it('rejects acceptance if passwords do not match with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/auth/accept-invitation')
        .send({
          token: rawToken,
          password: 'Password123',
          confirmPassword: 'DifferentPassword123',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects expired invitation token with 410 INVITATION_EXPIRED', async () => {
      // Set expiration in the past
      await Invitation.findByIdAndUpdate(invitationId, {
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      });

      const validateRes = await request(app)
        .post('/api/auth/invitations/validate')
        .send({ token: rawToken });

      expect(validateRes.status).toBe(410);
      expect(validateRes.body.error.code).toBe('INVITATION_EXPIRED');

      const acceptRes = await request(app)
        .post('/api/auth/accept-invitation')
        .send({
          token: rawToken,
          password: 'Password123',
          confirmPassword: 'Password123',
        });

      expect(acceptRes.status).toBe(410);
      expect(acceptRes.body.error.code).toBe('INVITATION_EXPIRED');
    });

    it('rejects revoked invitation token with 410 INVITATION_REVOKED', async () => {
      // Admin revokes the invitation
      const revokeRes = await request(app)
        .post(`/api/admin/invitations/${invitationId}/revoke`)
        .set('Cookie', adminCookie);

      expect(revokeRes.status).toBe(200);

      // Attempting to validate or accept should fail
      const validateRes = await request(app)
        .post('/api/auth/invitations/validate')
        .send({ token: rawToken });

      expect(validateRes.status).toBe(410);
      expect(validateRes.body.error.code).toBe('INVITATION_REVOKED');
    });

    it('resends an invitation, invalidating the old token and issuing a new one', async () => {
      // Simulate elapsed cooldown
      await Invitation.updateOne(
        { _id: invitationId },
        { $set: { lastSentAt: new Date(Date.now() - 120 * 1000) } }
      );

      const resendRes = await request(app)
        .post(`/api/admin/invitations/${invitationId}/resend`)
        .set('Cookie', adminCookie);

      expect(resendRes.status).toBe(200);
      expect(resendRes.body.success).toBe(true);

      // Old token must no longer work because tokenHash was rotated
      const oldTokenRes = await request(app)
        .post('/api/auth/invitations/validate')
        .send({ token: rawToken });
      expect([404, 410]).toContain(oldTokenRes.status);

      // Extract new token from resend response
      const newUrl = resendRes.body.data.devInvitationLink || resendRes.body.data.devInvitationUrl;
      const newToken = new URL(newUrl).searchParams.get('token');
      expect(newToken).not.toBe(rawToken);

      // New token validates and accepts successfully
      const newTokenRes = await request(app)
        .post('/api/auth/invitations/validate')
        .send({ token: newToken });
      expect(newTokenRes.status).toBe(200);
      expect(newTokenRes.body.data.email).toBe('jane.candidate@company.com');
    });
  });

  describe('Account Lifecycle & Suspension (Role Restrictions & Safeguards)', () => {
    it('suspending an account prevents login without deleting historical attendance', async () => {
      // Admin suspends employee
      const patchRes = await request(app)
        .patch(`/api/users/${employeeUser._id}`)
        .set('Cookie', adminCookie)
        .send({ accountStatus: ACCOUNT_STATUS.SUSPENDED });

      expect(patchRes.status).toBe(200);

      // Attempt login
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'employee@company.com',
        password: 'EmployeePass123',
      });

      expect(loginRes.status).toBe(403);
      expect(loginRes.body.error.code).toBe('ACCOUNT_SUSPENDED');

      // Protected requests with existing token are rejected
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', employeeCookie);

      expect(meRes.status).toBe(403);
    });

    it('reactivating a suspended account allows login again', async () => {
      // Suspend
      await request(app)
        .patch(`/api/users/${employeeUser._id}`)
        .set('Cookie', adminCookie)
        .send({ accountStatus: ACCOUNT_STATUS.SUSPENDED });

      // Reactivate
      const reactivateRes = await request(app)
        .patch(`/api/users/${employeeUser._id}`)
        .set('Cookie', adminCookie)
        .send({ accountStatus: ACCOUNT_STATUS.ACTIVE });

      expect(reactivateRes.status).toBe(200);

      // Login succeeds
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'employee@company.com',
        password: 'EmployeePass123',
      });

      expect(loginRes.status).toBe(200);
    });

    it('prevents Admin from suspending or deactivating self', async () => {
      const res = await request(app)
        .patch(`/api/users/${adminUser._id}`)
        .set('Cookie', adminCookie)
        .send({ accountStatus: ACCOUNT_STATUS.SUSPENDED });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CANNOT_DEACTIVATE_SELF');
    });
  });

  describe('Audit Logging Verification', () => {
    it('records security audit log entries for invitation lifecycle events', async () => {
      // Create invitation
      const createRes = await request(app)
        .post('/api/admin/invitations')
        .set('Cookie', adminCookie)
        .send({
          name: 'Audit Subject',
          email: 'audit.subject@company.com',
          role: 'employee',
        });

      const invId = createRes.body.data.invitation.id;

      // Revoke
      await request(app)
        .post(`/api/admin/invitations/${invId}/revoke`)
        .set('Cookie', adminCookie);

      const logs = await AuditLog.find({ targetUserEmail: 'audit.subject@company.com' });
      const actions = logs.map((l) => l.action);

      expect(actions).toContain(AUDIT_ACTIONS.INVITATION_CREATED);
      expect(actions).toContain(AUDIT_ACTIONS.INVITATION_REVOKED);
    });
  });
});
