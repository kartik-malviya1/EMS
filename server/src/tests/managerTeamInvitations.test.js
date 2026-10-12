import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { User } from '../models/user.model.js';
import { Invitation } from '../models/invitation.model.js';
import { AuditLog } from '../models/auditLog.model.js';
import { Notification } from '../models/notification.model.js';
import {
  ROLES,
  ACCOUNT_STATUS,
  INVITATION_STATUS,
  EMAIL_DELIVERY_STATUS,
} from '../config/constants.js';
import { setEmailProvider, getEmailProvider } from '../services/email/index.js';

describe('Manager Team Invitation & Enterprise Access Lifecycle', () => {
  let adminUser;
  let managerUser;
  let manager2User;
  let employeeUser;

  let adminCookie;
  let managerCookie;
  let manager2Cookie;
  let employeeCookie;

  let originalProvider;
  let lastSentToken = null;

  beforeEach(async () => {
    lastSentToken = null;
    const fakeProvider = {
      send: vi.fn().mockImplementation(async ({ html, text }) => {
        const match = /token=([a-f0-9]+)/i.exec(text || html || '');
        if (match) lastSentToken = match[1];
        return { ok: true, providerMessageId: 'fake_team_msg_001' };
      }),
      getStatus: vi.fn().mockResolvedValue({
        ok: true,
        lastEvent: 'delivered',
        createdAt: new Date().toISOString(),
      }),
    };
    originalProvider = getEmailProvider();
    setEmailProvider(fakeProvider);

    await User.deleteMany({});
    await Invitation.deleteMany({});
    await AuditLog.deleteMany({});
    await Notification.deleteMany({});

    // 1. Seed Initial Admin
    adminUser = await User.create({
      name: 'System Admin',
      email: 'admin@enterprise.com',
      passwordHash: await User.hashPassword('AdminSecret123'),
      role: ROLES.ADMIN,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      isActive: true,
    });

    // 2. Seed Manager 1
    managerUser = await User.create({
      name: 'Engineering Manager',
      email: 'manager1@enterprise.com',
      passwordHash: await User.hashPassword('ManagerSecret123'),
      role: ROLES.MANAGER,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      isActive: true,
    });

    // 3. Seed Manager 2
    manager2User = await User.create({
      name: 'Product Manager',
      email: 'manager2@enterprise.com',
      passwordHash: await User.hashPassword('Manager2Secret123'),
      role: ROLES.MANAGER,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      isActive: true,
    });

    // 4. Seed Employee
    employeeUser = await User.create({
      name: 'Regular Employee',
      email: 'employee@enterprise.com',
      passwordHash: await User.hashPassword('EmployeeSecret123'),
      role: ROLES.EMPLOYEE,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      isActive: true,
    });

    // Sign in Admin
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@enterprise.com', password: 'AdminSecret123' });
    adminCookie = adminLoginRes.headers['set-cookie'];

    // Sign in Manager 1
    const managerLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager1@enterprise.com', password: 'ManagerSecret123' });
    managerCookie = managerLoginRes.headers['set-cookie'];

    // Sign in Manager 2
    const manager2LoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager2@enterprise.com', password: 'Manager2Secret123' });
    manager2Cookie = manager2LoginRes.headers['set-cookie'];

    // Sign in Employee
    const employeeLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'employee@enterprise.com', password: 'EmployeeSecret123' });
    employeeCookie = employeeLoginRes.headers['set-cookie'];
  });

  afterAll(() => {
    if (originalProvider) {
      setEmailProvider(originalProvider);
    }
  });

  describe('1. Invitation Flow: Admin invites Manager -> Manager accepts -> Manager invites Employee', () => {
    it('allows Admin to invite a manager, manager sets password, then new manager invites employee to team', async () => {
      // Step A: Admin invites a new manager
      const inviteMgrRes = await request(app)
        .post('/api/admin/invitations')
        .set('Cookie', adminCookie)
        .send({
          name: 'Sarah Connor',
          email: 'sarah.connor@enterprise.com',
          role: ROLES.MANAGER,
          department: 'Security Operations',
          designation: 'Security Director',
        });

      expect(inviteMgrRes.status).toBe(201);
      const mgrToken = lastSentToken;
      expect(mgrToken).toBeDefined();

      // Step B: Sarah Connor accepts the invitation and establishes password
      const acceptRes = await request(app)
        .post('/api/auth/accept-invitation')
        .send({
          token: mgrToken,
          password: 'SarahPassword123!',
          confirmPassword: 'SarahPassword123!',
        });

      expect(acceptRes.status).toBe(200);

      // Verify Sarah is activated as manager
      const sarahInDb = await User.findOne({ email: 'sarah.connor@enterprise.com' });
      expect(sarahInDb.accountStatus).toBe(ACCOUNT_STATUS.ACTIVE);
      expect(sarahInDb.role).toBe(ROLES.MANAGER);

      // Step C: Sarah logs in as manager
      const sarahLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'sarah.connor@enterprise.com', password: 'SarahPassword123!' });
      expect(sarahLoginRes.status).toBe(200);
      const sarahCookie = sarahLoginRes.headers['set-cookie'];

      // Step D: Sarah invites an employee into her team
      const inviteDevRes = await request(app)
        .post('/api/team/invitations')
        .set('Cookie', sarahCookie)
        .send({
          name: 'John Connor',
          email: 'john.connor@enterprise.com',
          department: 'Security Operations',
          designation: 'Security Analyst',
        });

      expect(inviteDevRes.status).toBe(201);
      expect(inviteDevRes.body.data.invitation.email).toBe('john.connor@enterprise.com');
      expect(inviteDevRes.body.data.invitation.role).toBe(ROLES.EMPLOYEE);
      expect(inviteDevRes.body.data.invitation.invitedByRole).toBe(ROLES.MANAGER);

      // Verify John is auto-assigned to Sarah's team
      const johnInDb = await User.findOne({ email: 'john.connor@enterprise.com' });
      expect(johnInDb.role).toBe(ROLES.EMPLOYEE);
      expect(johnInDb.managerId.toString()).toBe(sarahInDb._id.toString());
      expect(johnInDb.accountStatus).toBe(ACCOUNT_STATUS.INVITED);
    });
  });

  describe('2. Payload Restrictions & Role Guards for Team Invitations', () => {
    it('rejects invitation when manager attempts to supply a role (strict schema forbids role)', async () => {
      const res = await request(app)
        .post('/api/team/invitations')
        .set('Cookie', managerCookie)
        .send({
          name: 'Unauthorized Role Attempt',
          email: 'unauth.role@enterprise.com',
          role: 'manager',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invitation when manager attempts to supply managerId', async () => {
      const res = await request(app)
        .post('/api/team/invitations')
        .set('Cookie', managerCookie)
        .send({
          name: 'Unauthorized Manager Assignment',
          email: 'unauth.mgr@enterprise.com',
          managerId: manager2User._id.toString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('forbids manager from accessing admin invitations endpoint', async () => {
      const res = await request(app)
        .post('/api/admin/invitations')
        .set('Cookie', managerCookie)
        .send({
          name: 'Escalation Attempt',
          email: 'escalate@enterprise.com',
          role: ROLES.EMPLOYEE,
        });

      expect(res.status).toBe(403);
    });

    it('forbids employee from accessing team invitations endpoint', async () => {
      const res = await request(app)
        .post('/api/team/invitations')
        .set('Cookie', employeeCookie)
        .send({
          name: 'Employee Attempt',
          email: 'emp.attempt@enterprise.com',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('3. Duplicate Email & Stub Reuse Scenarios', () => {
    it('returns generic 409 EMAIL_ALREADY_EXISTS when email belongs to an existing user', async () => {
      const res = await request(app)
        .post('/api/team/invitations')
        .set('Cookie', managerCookie)
        .send({
          name: 'Duplicate Admin Email',
          email: 'admin@enterprise.com',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('returns 409 INVITATION_ALREADY_PENDING if an invitation is already pending in caller team', async () => {
      // First invitation
      await request(app)
        .post('/api/team/invitations')
        .set('Cookie', managerCookie)
        .send({
          name: 'Pending Member',
          email: 'pending.member@enterprise.com',
        });

      // Second invitation while first is still pending
      const duplicateRes = await request(app)
        .post('/api/team/invitations')
        .set('Cookie', managerCookie)
        .send({
          name: 'Pending Member Again',
          email: 'pending.member@enterprise.com',
        });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.error.code).toBe('INVITATION_ALREADY_PENDING');
    });

    it('returns generic 409 EMAIL_ALREADY_EXISTS if invitation is pending in another manager team', async () => {
      // Manager 1 invites
      await request(app)
        .post('/api/team/invitations')
        .set('Cookie', managerCookie)
        .send({
          name: 'Team 1 Member',
          email: 'team1.member@enterprise.com',
        });

      // Manager 2 tries to invite same email
      const manager2Res = await request(app)
        .post('/api/team/invitations')
        .set('Cookie', manager2Cookie)
        .send({
          name: 'Team 1 Member',
          email: 'team1.member@enterprise.com',
        });

      expect(manager2Res.status).toBe(409);
      expect(manager2Res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('allows re-inviting a revoked or expired stub within caller team and issues a fresh invitation', async () => {
      // Create and then revoke
      const initialRes = await request(app)
        .post('/api/team/invitations')
        .set('Cookie', managerCookie)
        .send({
          name: 'Revoked Member',
          email: 'revoked.member@enterprise.com',
        });

      const invId = initialRes.body.data.invitation.id;

      await request(app)
        .post(`/api/team/invitations/${invId}/revoke`)
        .set('Cookie', managerCookie);

      // Re-invite the same email
      const reInviteRes = await request(app)
        .post('/api/team/invitations')
        .set('Cookie', managerCookie)
        .send({
          name: 'Revoked Member Renewed',
          email: 'revoked.member@enterprise.com',
        });

      expect(reInviteRes.status).toBe(201);
      expect(reInviteRes.body.data.invitation.status).toBe(INVITATION_STATUS.PENDING);
    });
  });

  describe('4. Dynamic Scope Isolation Between Managers', () => {
    it('manager cannot view, resend, or revoke invitations belonging to another manager team', async () => {
      // Manager 1 creates invitation
      const createRes = await request(app)
        .post('/api/team/invitations')
        .set('Cookie', managerCookie)
        .send({
          name: 'Manager 1 Direct Report',
          email: 'report1@enterprise.com',
        });

      const invId = createRes.body.data.invitation.id;

      // Manager 2 tries to GET the invitation -> 404 NOT_FOUND
      const getRes = await request(app)
        .get(`/api/team/invitations/${invId}`)
        .set('Cookie', manager2Cookie);
      expect(getRes.status).toBe(404);

      // Manager 2 tries to RESEND the invitation -> 404 NOT_FOUND
      const resendRes = await request(app)
        .post(`/api/team/invitations/${invId}/resend`)
        .set('Cookie', manager2Cookie);
      expect(resendRes.status).toBe(404);

      // Manager 2 tries to REVOKE the invitation -> 404 NOT_FOUND
      const revokeRes = await request(app)
        .post(`/api/team/invitations/${invId}/revoke`)
        .set('Cookie', manager2Cookie);
      expect(revokeRes.status).toBe(404);

      // Manager 2 list does not contain Manager 1 invitation
      const listRes = await request(app)
        .get('/api/team/invitations')
        .set('Cookie', manager2Cookie);
      expect(listRes.status).toBe(200);
      const found = listRes.body.data.some((inv) => inv.id === invId);
      expect(found).toBe(false);
    });
  });

  describe('5. Token Invalidation, Resend Rotation, and Single-Use', () => {
    it('resending rotates token and invalidates the previous token', async () => {
      const inviteRes = await request(app)
        .post('/api/team/invitations')
        .set('Cookie', managerCookie)
        .send({
          name: 'Token Test User',
          email: 'tokentest@enterprise.com',
        });

      const firstToken = lastSentToken;
      const invId = inviteRes.body.data.invitation.id;

      // Bypass cooldown by setting lastSentAt in the past
      await Invitation.findByIdAndUpdate(invId, {
        lastSentAt: new Date(Date.now() - 120000),
      });

      // Resend
      const resendRes = await request(app)
        .post(`/api/team/invitations/${invId}/resend`)
        .set('Cookie', managerCookie);
      expect(resendRes.status).toBe(200);

      const secondToken = lastSentToken;
      expect(secondToken).not.toBe(firstToken);

      // Attempting to accept with first token should fail (404 INVALID_TOKEN)
      const acceptFirstRes = await request(app)
        .post('/api/auth/accept-invitation')
        .send({
          token: firstToken,
          password: 'ValidPassword123!',
          confirmPassword: 'ValidPassword123!',
        });
      expect(acceptFirstRes.status).toBe(404);
      expect(acceptFirstRes.body.error.code).toBe('INVALID_TOKEN');

      // Accepting with second token succeeds
      const acceptSecondRes = await request(app)
        .post('/api/auth/accept-invitation')
        .send({
          token: secondToken,
          password: 'ValidPassword123!',
          confirmPassword: 'ValidPassword123!',
        });
      expect(acceptSecondRes.status).toBe(200);

      // Attempting to reuse second token fails (409 INVITATION_ALREADY_ACCEPTED)
      const acceptReuseRes = await request(app)
        .post('/api/auth/accept-invitation')
        .send({
          token: secondToken,
          password: 'ValidPassword123!',
          confirmPassword: 'ValidPassword123!',
        });
      expect(acceptReuseRes.status).toBe(409);
      expect(acceptReuseRes.body.error.code).toBe('INVITATION_ALREADY_ACCEPTED');
    });
  });

  describe('6. Suspended Manager Cannot Access Team Management', () => {
    it('suspended manager receives 403 when trying to access team invitations', async () => {
      // Suspend manager 1
      await User.findByIdAndUpdate(managerUser._id, {
        accountStatus: ACCOUNT_STATUS.SUSPENDED,
      });

      const res = await request(app)
        .post('/api/team/invitations')
        .set('Cookie', managerCookie)
        .send({
          name: 'Should Be Blocked',
          email: 'blocked@enterprise.com',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
    });
  });

  describe('7. Manager Demotion & Deactivation Blocked with Pending/Invited Team Members', () => {
    it('blocks demoting a manager to employee with 409 HAS_TEAM_MEMBERS when invited members exist', async () => {
      // Manager 1 invites an employee (stub in 'invited' state)
      await request(app)
        .post('/api/team/invitations')
        .set('Cookie', managerCookie)
        .send({
          name: 'Team Stub Member',
          email: 'stub@enterprise.com',
        });

      // Admin tries to demote Manager 1 to employee
      const demoteRes = await request(app)
        .patch(`/api/users/${managerUser._id}`)
        .set('Cookie', adminCookie)
        .send({
          role: ROLES.EMPLOYEE,
        });

      expect(demoteRes.status).toBe(409);
      expect(demoteRes.body.error.code).toBe('HAS_TEAM_MEMBERS');
    });

    it('blocks deactivating a manager with 409 HAS_TEAM_MEMBERS when invited members exist', async () => {
      // Manager 1 invites an employee
      await request(app)
        .post('/api/team/invitations')
        .set('Cookie', managerCookie)
        .send({
          name: 'Team Stub Member 2',
          email: 'stub2@enterprise.com',
        });

      // Admin tries to deactivate Manager 1
      const deactivateRes = await request(app)
        .patch(`/api/users/${managerUser._id}`)
        .set('Cookie', adminCookie)
        .send({
          accountStatus: ACCOUNT_STATUS.DEACTIVATED,
        });

      expect(deactivateRes.status).toBe(409);
      expect(deactivateRes.body.error.code).toBe('HAS_TEAM_MEMBERS');
    });
  });

  describe('8. Employee Acceptance Preserves Admin-Reassigned Manager', () => {
    it('preserves reassigned managerId on employee acceptance if admin modified it while pending', async () => {
      // Manager 1 invites an employee
      const inviteRes = await request(app)
        .post('/api/team/invitations')
        .set('Cookie', managerCookie)
        .send({
          name: 'Reassigned Candidate',
          email: 'reassigned@enterprise.com',
        });

      const empToken = lastSentToken;
      const candidateUser = await User.findOne({ email: 'reassigned@enterprise.com' });

      // Admin reassigns candidate to Manager 2 before acceptance
      const reassignRes = await request(app)
        .patch(`/api/users/${candidateUser._id}`)
        .set('Cookie', adminCookie)
        .send({
          managerId: manager2User._id.toString(),
        });
      expect(reassignRes.status).toBe(200);

      // Candidate accepts the invitation
      const acceptRes = await request(app)
        .post('/api/auth/accept-invitation')
        .send({
          token: empToken,
          password: 'FreshPassword123!',
          confirmPassword: 'FreshPassword123!',
        });
      expect(acceptRes.status).toBe(200);

      // Verify the activated employee remains assigned to Manager 2
      const acceptedUser = await User.findOne({ email: 'reassigned@enterprise.com' });
      expect(acceptedUser.accountStatus).toBe(ACCOUNT_STATUS.ACTIVE);
      expect(acceptedUser.managerId.toString()).toBe(manager2User._id.toString());
      expect(acceptedUser.role).toBe(ROLES.EMPLOYEE);
    });
  });

  describe('9. Notifications On Invitation Acceptance', () => {
    it('notifies inviter upon employee acceptance', async () => {
      await request(app)
        .post('/api/team/invitations')
        .set('Cookie', managerCookie)
        .send({
          name: 'Notified Employee',
          email: 'notified@enterprise.com',
        });

      const token = lastSentToken;

      await request(app)
        .post('/api/auth/accept-invitation')
        .send({
          token,
          password: 'NotifyPassword123!',
          confirmPassword: 'NotifyPassword123!',
        });

      // Check notification sent to manager 1
      const notifs = await Notification.find({ userId: managerUser._id });
      expect(notifs.length).toBeGreaterThan(0);
      expect(notifs[0].type).toBe('invitation_accepted');
      expect(notifs[0].title).toContain('Invitation Accepted');
    });
  });
});
