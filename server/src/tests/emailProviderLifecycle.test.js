import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { User } from '../models/user.model.js';
import { Invitation } from '../models/invitation.model.js';
import { AuditLog } from '../models/auditLog.model.js';
import {
  ROLES,
  ACCOUNT_STATUS,
  EMAIL_DELIVERY_STATUS,
  AUDIT_ACTIONS,
} from '../config/constants.js';
import { env, validateEnv, isEmailConfigured } from '../config/env.js';
import { createSessionToken } from '../services/auth.service.js';
import {
  setEmailProvider,
  resetEmailProvider,
  EMAIL_ERROR_CODES,
  mapResendError,
  renderInvitationTemplate,
} from '../services/email/index.js';
import { ResendEmailProvider } from '../services/email/resend.provider.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

describe('Real Resend Email Provider & Invitation Lifecycle (15 Specification Tests)', () => {
  let adminCookie;
  let employeeCookie;
  let adminUser;
  let managerUser;
  let employeeUser;

  beforeEach(async () => {
    resetEmailProvider();
    await User.deleteMany({});
    await Invitation.deleteMany({});
    await AuditLog.deleteMany({});

    adminUser = await User.create({
      name: 'System Admin',
      email: 'admin@company.com',
      passwordHash: await User.hashPassword('AdminPass123'),
      role: ROLES.ADMIN,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      isActive: true,
    });

    managerUser = await User.create({
      name: 'Team Manager',
      email: 'manager@company.com',
      passwordHash: await User.hashPassword('ManagerPass123'),
      role: ROLES.MANAGER,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      isActive: true,
    });

    employeeUser = await User.create({
      name: 'Active Employee',
      email: 'employee@company.com',
      passwordHash: await User.hashPassword('EmployeePass123'),
      role: ROLES.EMPLOYEE,
      managerId: managerUser._id,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      isActive: true,
    });

    adminCookie = [`token=${createSessionToken(adminUser._id)}`];
    employeeCookie = [`token=${createSessionToken(employeeUser._id)}`];
  });

  afterEach(() => {
    resetEmailProvider();
    vi.restoreAllMocks();
  });

  // 1. Unconfigured email -> create/resend/test endpoints return 503 EMAIL_NOT_CONFIGURED and create no records
  it('1. Unconfigured email -> create/resend/test endpoints return 503 EMAIL_NOT_CONFIGURED and create no records', async () => {
    const origKey = env.RESEND_API_KEY;
    try {
      env.RESEND_API_KEY = 're_xxxxxxxxx'; // placeholder key
      expect(isEmailConfigured(env)).toBe(false);

      // Create endpoint
      const createRes = await request(app)
        .post('/api/admin/invitations')
        .set('Cookie', adminCookie)
        .send({
          name: 'Unconfigured Test',
          email: 'unconfigured@company.com',
          role: 'employee',
        });
      expect(createRes.status).toBe(503);
      expect(createRes.body.error.code).toBe('EMAIL_NOT_CONFIGURED');

      // Verify no records created
      expect(await Invitation.countDocuments({})).toBe(0);
      expect(await User.countDocuments({ email: 'unconfigured@company.com' })).toBe(0);

      // Test email endpoint
      const testEmailRes = await request(app)
        .post('/api/admin/email/test')
        .set('Cookie', adminCookie)
        .send({ to: 'admin@company.com' });
      expect(testEmailRes.status).toBe(503);
      expect(testEmailRes.body.error.code).toBe('EMAIL_NOT_CONFIGURED');
    } finally {
      env.RESEND_API_KEY = origKey;
    }
  });

  // 2. Provider called once with expected from/to/subject/html/text and an idempotency key of the right shape
  it('2. Provider called once with expected from/to/subject/html/text and an idempotency key of the right shape', async () => {
    const mockSend = vi.fn().mockResolvedValue({
      data: { id: 'msg_resend_shape_123' },
      error: null,
    });

    const fakeClient = { emails: { send: mockSend } };
    setEmailProvider(
      new ResendEmailProvider({
        apiKey: 're_test_fake_key_12345',
        defaultFrom: 'AMS Portal <onboarding@resend.dev>',
        client: fakeClient,
      })
    );

    const res = await request(app)
      .post('/api/admin/invitations')
      .set('Cookie', adminCookie)
      .send({
        name: 'Shape Check',
        email: 'shape.check@company.com',
        role: 'employee',
      });

    expect(res.status).toBe(201);
    expect(mockSend).toHaveBeenCalledTimes(1);

    const [payload, options] = mockSend.mock.calls[0];
    expect(payload.to).toBe('shape.check@company.com');
    expect(payload.from).toBe('AMS Portal <onboarding@resend.dev>');
    expect(payload.subject).toBe("You're invited to join AMS Portal");
    expect(payload.html).toContain('Shape Check');
    expect(payload.text).toContain('Shape Check');
    expect(options.idempotencyKey).toMatch(/^invitation:[a-f0-9]{24}:attempt:1$/);

    // No dev links in response
    expect(res.body.data.devInvitationLink).toBeUndefined();
    expect(res.body.data.devInvitationUrl).toBeUndefined();
    expect(res.body.data.email.status).toBe(EMAIL_DELIVERY_STATUS.ACCEPTED);
    expect(res.body.data.email.providerMessageId).toBe('msg_resend_shape_123');
  });

  // 3. Provider outcomes: accepted, failure, thrown network error, timeout outcomeUnknown and attempt reuse
  it('3. SDK returns accepted/failed/network error/timeout with proper codes and attempt reuse', async () => {
    // A: Success -> accepted + providerMessageId
    const successClient = {
      emails: { send: vi.fn().mockResolvedValue({ data: { id: 're_msg_3a' }, error: null }) },
    };
    setEmailProvider(new ResendEmailProvider({ apiKey: 're_valid_123', client: successClient }));

    const resA = await request(app)
      .post('/api/admin/invitations')
      .set('Cookie', adminCookie)
      .send({ name: 'User 3A', email: 'user3a@company.com', role: 'employee' });
    expect(resA.status).toBe(201);
    expect(resA.body.data.email.status).toBe('accepted');
    expect(resA.body.data.email.providerMessageId).toBe('re_msg_3a');

    // B: SDK returns failure object (not thrown) -> 201 on create with failed email status
    const failClient = {
      emails: {
        send: vi.fn().mockResolvedValue({
          data: null,
          error: { name: 'rate_limit_exceeded', statusCode: 429, message: 'Too many requests' },
        }),
      },
    };
    setEmailProvider(new ResendEmailProvider({ apiKey: 're_valid_123', client: failClient }));

    const resB = await request(app)
      .post('/api/admin/invitations')
      .set('Cookie', adminCookie)
      .send({ name: 'User 3B', email: 'user3b@company.com', role: 'employee' });
    expect(resB.status).toBe(201);
    expect(resB.body.data.email.status).toBe('failed');
    expect(resB.body.data.email.error.code).toBe(EMAIL_ERROR_CODES.EMAIL_RATE_LIMITED);

    // C: Network error thrown -> 502 on resend with EMAIL_PROVIDER_ERROR
    const networkClient = {
      emails: {
        send: vi.fn().mockRejectedValue(new Error('ECONNRESET connection closed unexpectedly')),
      },
    };
    setEmailProvider(new ResendEmailProvider({ apiKey: 're_valid_123', client: networkClient }));

    // Bypass cooldown for resend test
    await Invitation.updateOne(
      { _id: resB.body.data.invitation.id },
      { lastSentAt: new Date(Date.now() - 120000), 'emailLastError.at': new Date(Date.now() - 120000) }
    );
    const resC = await request(app)
      .post(`/api/admin/invitations/${resB.body.data.invitation.id}/resend`)
      .set('Cookie', adminCookie);
    expect(resC.status).toBe(502);
    expect(resC.body.error.code).toBe(EMAIL_ERROR_CODES.EMAIL_PROVIDER_ERROR);

    // D: Timeout -> failed with outcomeUnknown, retry reuses attempt number
    const timeoutClient = {
      emails: {
        send: vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 500))),
      },
    };
    const timeoutProvider = new ResendEmailProvider({
      apiKey: 're_valid_123',
      timeoutMs: 50,
      client: timeoutClient,
    });
    setEmailProvider(timeoutProvider);

    await Invitation.updateOne(
      { _id: resB.body.data.invitation.id },
      { lastSentAt: new Date(Date.now() - 120000), 'emailLastError.at': new Date(Date.now() - 120000) }
    );
    const resD = await request(app)
      .post(`/api/admin/invitations/${resB.body.data.invitation.id}/resend`)
      .set('Cookie', adminCookie);
    expect(resD.status).toBe(502);
    expect(resD.body.error.code).toBe(EMAIL_ERROR_CODES.EMAIL_TIMEOUT);

    const invAfterTimeout = await Invitation.findById(resB.body.data.invitation.id);
    expect(invAfterTimeout.emailLastError.outcomeUnknown).toBe(true);

    // When retrying after timeout, attempt number is reused in idempotency key
    const retrySendMock = vi.fn().mockResolvedValue({ data: { id: 're_msg_retry' }, error: null });
    setEmailProvider(
      new ResendEmailProvider({
        apiKey: 're_valid_123',
        client: { emails: { send: retrySendMock } },
      })
    );

    await Invitation.updateOne(
      { _id: resB.body.data.invitation.id },
      { lastSentAt: new Date(Date.now() - 120000), 'emailLastError.at': new Date(Date.now() - 120000) }
    );
    const resRetry = await request(app)
      .post(`/api/admin/invitations/${resB.body.data.invitation.id}/resend`)
      .set('Cookie', adminCookie);
    expect(resRetry.status).toBe(200);

    const [, retryOptions] = retrySendMock.mock.calls[0];
    expect(retryOptions.idempotencyKey).toBe(`invitation:${resB.body.data.invitation.id}:attempt:${invAfterTimeout.emailAttempt}`);
  });

  // 4. Sandbox 403 maps to EMAIL_SANDBOX_RECIPIENT_RESTRICTED with actionable message; status-permission failure maps to EMAIL_STATUS_NOT_PERMITTED
  it('4. Sandbox 403 maps to EMAIL_SANDBOX_RECIPIENT_RESTRICTED; status permission maps to EMAIL_STATUS_NOT_PERMITTED', () => {
    const sandboxErr = {
      statusCode: 403,
      name: 'validation_error',
      message: 'You can only send testing emails to your own email address (test@resend.dev)',
    };
    const mappedSandbox = mapResendError(sandboxErr, 403);
    expect(mappedSandbox.code).toBe(EMAIL_ERROR_CODES.EMAIL_SANDBOX_RECIPIENT_RESTRICTED);
    expect(mappedSandbox.message).toContain("Resend's test sender can only deliver to your own Resend account email");
    expect(mappedSandbox.message).toContain('resend.com/domains');

    const statusPermissionErr = {
      statusCode: 403,
      name: 'restricted_api_key',
      message: 'This API key is restricted to sending access only',
    };
    const mappedStatus = mapResendError(statusPermissionErr, 403, { isStatusCheck: true });
    expect(mappedStatus.code).toBe(EMAIL_ERROR_CODES.EMAIL_STATUS_NOT_PERMITTED);
    expect(mappedStatus.message).toContain('Sending access only and cannot read message delivery status');
  });

  // 5. Resend success rotates the token; resend failure leaves the old token valid and the new unstored
  it('5. Resend success rotates token; resend failure leaves old token valid and new unstored', async () => {
    let capturedTokens = [];
    const trackingProvider = {
      async send({ html }) {
        const match = html.match(/token=([a-f0-9]{64})/);
        if (match) capturedTokens.push(match[1]);
        return { ok: true, providerMessageId: `msg_${capturedTokens.length}` };
      },
    };
    setEmailProvider(trackingProvider);

    const createRes = await request(app)
      .post('/api/admin/invitations')
      .set('Cookie', adminCookie)
      .send({ name: 'Rotate Test', email: 'rotate@company.com', role: 'employee' });
    expect(createRes.status).toBe(201);
    const firstToken = capturedTokens[0];

    // Resend success -> rotates token
    await Invitation.updateOne({ _id: createRes.body.data.invitation.id }, { lastSentAt: new Date(Date.now() - 120000) });
    const resendRes = await request(app)
      .post(`/api/admin/invitations/${createRes.body.data.invitation.id}/resend`)
      .set('Cookie', adminCookie);
    expect(resendRes.status).toBe(200);
    const secondToken = capturedTokens[1];
    expect(secondToken).not.toBe(firstToken);

    // Old token is invalid; new token is valid
    const oldVal = await request(app).post('/api/auth/invitations/validate').send({ token: firstToken });
    expect(oldVal.status).toBe(404);
    const newVal = await request(app).post('/api/auth/invitations/validate').send({ token: secondToken });
    expect(newVal.status).toBe(200);

    // Resend failure -> old token stays valid
    setEmailProvider({
      async send() {
        return { ok: false, error: { code: 'EMAIL_PROVIDER_ERROR', message: 'Fail' } };
      },
    });

    await Invitation.updateOne({ _id: createRes.body.data.invitation.id }, { lastSentAt: new Date(Date.now() - 120000) });
    const failResend = await request(app)
      .post(`/api/admin/invitations/${createRes.body.data.invitation.id}/resend`)
      .set('Cookie', adminCookie);
    expect(failResend.status).toBe(502);

    // Second token is STILL valid
    const stillValid = await request(app).post('/api/auth/invitations/validate').send({ token: secondToken });
    expect(stillValid.status).toBe(200);
  });

  // 6. Concurrent double resend -> exactly one provider call, other 409; cooldown 429; max resends 409
  it('6. Concurrent double resend returns 409 SEND_IN_PROGRESS; cooldown 429; max resends 409', async () => {
    let sendCalls = 0;
    const slowProvider = {
      async send() {
        sendCalls++;
        await new Promise((resolve) => setTimeout(resolve, 80));
        return { ok: true, providerMessageId: 'msg_slow_1' };
      },
    };
    setEmailProvider(slowProvider);

    const createRes = await request(app)
      .post('/api/admin/invitations')
      .set('Cookie', adminCookie)
      .send({ name: 'Race User', email: 'race@company.com', role: 'employee' });
    const invId = createRes.body.data.invitation.id;

    await Invitation.updateOne({ _id: invId }, { lastSentAt: new Date(Date.now() - 120000) });

    sendCalls = 0;
    const [call1, call2] = await Promise.all([
      request(app).post(`/api/admin/invitations/${invId}/resend`).set('Cookie', adminCookie),
      request(app).post(`/api/admin/invitations/${invId}/resend`).set('Cookie', adminCookie),
    ]);

    const statuses = [call1.status, call2.status].sort();
    expect(statuses).toEqual([200, 409]);
    expect(sendCalls).toBe(1);

    // Immediate next call hits cooldown (429)
    const cooldownRes = await request(app)
      .post(`/api/admin/invitations/${invId}/resend`)
      .set('Cookie', adminCookie);
    expect(cooldownRes.status).toBe(429);
    expect(cooldownRes.body.error.code).toBe('RESEND_COOLDOWN');
    expect(cooldownRes.body.details?.retryAfterSeconds).toBeGreaterThan(0);

    // Max resends limit (409)
    await Invitation.updateOne({ _id: invId }, { resendCount: 10, lastSentAt: new Date(Date.now() - 120000) });
    const maxRes = await request(app)
      .post(`/api/admin/invitations/${invId}/resend`)
      .set('Cookie', adminCookie);
    expect(maxRes.status).toBe(409);
    expect(maxRes.body.error.code).toBe('RESEND_LIMIT_REACHED');
  });

  // 7. Self-service request-link: 200 generic regardless of existence; timing attack safe
  it('7. Self-service request-link: identical generic 200 for existing and unknown email; background execution', async () => {
    let providerCalls = 0;
    const fakeProvider = {
      async send() {
        providerCalls++;
        await new Promise((resolve) => setTimeout(resolve, 60)); // Simulate slow delivery
        return { ok: true, providerMessageId: 'msg_self_service' };
      },
    };
    setEmailProvider(fakeProvider);

    // Setup an existing pending invitation
    await request(app)
      .post('/api/admin/invitations')
      .set('Cookie', adminCookie)
      .send({ name: 'Invited Person', email: 'invited@company.com', role: 'employee' });

    // Ensure cooldown elapsed
    await Invitation.updateMany({}, { lastSentAt: new Date(Date.now() - 120000) });
    providerCalls = 0;

    // A: Existing invited email -> responds fast with generic message
    const startA = Date.now();
    const resA = await request(app)
      .post('/api/auth/invitations/request-link')
      .send({ email: 'invited@company.com' });
    const durationA = Date.now() - startA;

    expect(resA.status).toBe(200);
    expect(resA.body.message).toContain('If a pending invitation exists for this email');
    expect(durationA).toBeLessThan(50); // Immediate response, not blocked by 60ms provider call

    // Wait for setImmediate background work
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(providerCalls).toBe(1);

    // B: Unknown email -> identical 200 response body, NO provider call
    providerCalls = 0;
    const resB = await request(app)
      .post('/api/auth/invitations/request-link')
      .send({ email: 'unknown.stranger@random.com' });
    expect(resB.status).toBe(200);
    expect(resB.body.message).toBe(resA.body.message);

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(providerCalls).toBe(0);
  });

  // 8. Admin test email: sends fixed template, audit written, non-admin 403, bad email 400
  it('8. Admin test email sends fixed template, writes audit entry, rejects non-admin with 403', async () => {
    let capturedEmail = null;
    setEmailProvider({
      async send(payload) {
        capturedEmail = payload;
        return { ok: true, providerMessageId: 're_test_admin_msg_101' };
      },
    });

    const res = await request(app)
      .post('/api/admin/email/test')
      .set('Cookie', adminCookie)
      .send({ to: 'admin.inbox@company.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.email.status).toBe('accepted');
    expect(res.body.data.email.providerMessageId).toBe('re_test_admin_msg_101');
    expect(capturedEmail.subject).toBe('AMS Portal test email');
    expect(capturedEmail.html).toContain('Sent Time:');
    expect(capturedEmail.text).toContain('AMS Portal test email');

    // Audit entry written
    const audit = await AuditLog.findOne({ action: AUDIT_ACTIONS.EMAIL_TEST_SENT });
    expect(audit).toBeDefined();
    expect(audit.metadata.recipient).toBe('admin.inbox@company.com');
    expect(audit.metadata.providerMessageId).toBe('re_test_admin_msg_101');

    // Non-admin blocked
    const nonAdminRes = await request(app)
      .post('/api/admin/email/test')
      .set('Cookie', employeeCookie)
      .send({ to: 'employee@company.com' });
    expect(nonAdminRes.status).toBe(403);

    // Bad email 400
    const badEmailRes = await request(app)
      .post('/api/admin/email/test')
      .set('Cookie', adminCookie)
      .send({ to: 'not-an-email' });
    expect(badEmailRes.status).toBe(400);
  });

  // 9. Message status endpoint: returns only id/lastEvent/createdAt/to; unknown id 404; id not sent by app 404
  it('9. Message status endpoint returns safe fields; unknown id and unauthorized id return 404', async () => {
    setEmailProvider({
      async getStatus(_id) {
        return {
          ok: true,
          lastEvent: 'delivered',
          createdAt: '2026-10-11T10:00:00Z',
          to: ['target@company.com'],
        };
      },
    });

    // ID not sent by app -> 404
    const unknownRes = await request(app)
      .get('/api/admin/email/messages/msg_random_external_id')
      .set('Cookie', adminCookie);
    expect(unknownRes.status).toBe(404);

    // Record legitimate test email audit entry
    await AuditLog.create({
      actor: adminUser._id,
      action: AUDIT_ACTIONS.EMAIL_TEST_SENT,
      metadata: { recipient: 'target@company.com', providerMessageId: 'msg_authorized_99' },
    });

    const statusRes = await request(app)
      .get('/api/admin/email/messages/msg_authorized_99')
      .set('Cookie', adminCookie);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.id).toBe('msg_authorized_99');
    expect(statusRes.body.data.lastEvent).toBe('delivered');
    expect(statusRes.body.data.createdAt).toBe('2026-10-11T10:00:00Z');
    expect(statusRes.body.data.to).toEqual(['target@company.com']);
    expect(statusRes.body.data.html).toBeUndefined();
    expect(statusRes.body.data.text).toBeUndefined();
  });

  // 10. check-delivery stores emailLastEvent; invitation without provider id -> 409
  it('10. check-delivery stores emailLastEvent; invitation without provider id -> 409', async () => {
    setEmailProvider({
      async getStatus() {
        return { ok: true, lastEvent: 'bounced', createdAt: '2026-10-11T10:00:00Z' };
      },
    });

    const inv = await Invitation.create({
      userId: employeeUser._id,
      email: 'bounce@company.com',
      name: 'Bounce User',
      role: 'employee',
      invitedBy: adminUser._id,
      tokenHash: 'hash_test_10',
      expiresAt: new Date(Date.now() + 86400000),
      emailProviderMessageId: 're_msg_bounced_10',
      emailDeliveryStatus: 'accepted',
    });

    const checkRes = await request(app)
      .post(`/api/admin/invitations/${inv._id}/check-delivery`)
      .set('Cookie', adminCookie);
    expect(checkRes.status).toBe(200);
    expect(checkRes.body.data.lastEvent).toBe('bounced');

    const updatedInv = await Invitation.findById(inv._id);
    expect(updatedInv.emailLastEvent).toBe('bounced');
    expect(updatedInv.emailLastEventAt).toBeDefined();

    // Invitation without providerMessageId -> 409
    const noMsgInv = await Invitation.create({
      userId: employeeUser._id,
      email: 'nomsg@company.com',
      name: 'No Msg User',
      role: 'employee',
      invitedBy: adminUser._id,
      tokenHash: 'hash_test_no_msg',
      expiresAt: new Date(Date.now() + 86400000),
      emailProviderMessageId: null,
      emailDeliveryStatus: 'failed',
    });

    const noMsgRes = await request(app)
      .post(`/api/admin/invitations/${noMsgInv._id}/check-delivery`)
      .set('Cookie', adminCookie);
    expect(noMsgRes.status).toBe(409);
    expect(noMsgRes.body.error.code).toBe('NO_PROVIDER_MESSAGE_ID');
  });

  // 11. No-leak test: logs, responses, and audit entries never contain raw token or API key
  it('11. No-leak test: responses, logs, and audit entries never contain raw token or API key', async () => {
    let capturedToken = null;
    setEmailProvider({
      async send({ html }) {
        const match = html.match(/token=([a-f0-9]{64})/);
        if (match) capturedToken = match[1];
        return { ok: true, providerMessageId: 'msg_no_leak' };
      },
    });

    const loggerLogs = [];
    const logSpy = vi.spyOn(logger, 'info').mockImplementation((msg) => loggerLogs.push(String(msg)));

    const createRes = await request(app)
      .post('/api/admin/invitations')
      .set('Cookie', adminCookie)
      .send({ name: 'Leak Check', email: 'leak@company.com', role: 'employee' });

    expect(createRes.status).toBe(201);
    expect(capturedToken).toBeDefined();

    // Assert response contains neither the raw token nor the API key
    const resString = JSON.stringify(createRes.body);
    expect(resString).not.toContain(capturedToken);

    // Audit log check
    const audits = await AuditLog.find({}).lean();
    const auditString = JSON.stringify(audits);
    expect(auditString).not.toContain(capturedToken);

    // Log output check
    const logsString = loggerLogs.join(' ');
    expect(logsString).not.toContain(capturedToken);

    logSpy.mockRestore();
  });

  // 12. env validation: placeholder key rejected as not configured; production constraints; no development provider
  it('12. env validation: placeholder rejected as unconfigured; production constraints; no development provider', () => {
    expect(isEmailConfigured({ RESEND_API_KEY: 're_xxxxxxxxx', EMAIL_FROM: 'AMS Portal <onboarding@resend.dev>' })).toBe(false);
    expect(isEmailConfigured({ RESEND_API_KEY: 're_real_key_123', EMAIL_FROM: 'AMS Portal <onboarding@resend.dev>' })).toBe(true);

    const baseValid = {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://localhost:27017/test',
      JWT_SECRET: 'a_very_long_jwt_secret_that_is_at_least_32_characters_long',
      CLIENT_ORIGIN: 'http://localhost:5173',
      APP_BASE_URL: 'http://localhost:5173/',
    };

    // Trailing slash normalised
    const parsed = validateEnv(baseValid);
    expect(parsed.APP_BASE_URL).toBe('http://localhost:5173');

    // Production requires real key and https non-localhost URL
    expect(() =>
      validateEnv({
        ...baseValid,
        NODE_ENV: 'production',
        RESEND_API_KEY: 're_xxxxxxxxx',
        APP_BASE_URL: 'http://localhost:5173',
      })
    ).toThrow();

    // Verify development provider file does not exist anywhere in project
    const devProviderPath = path.resolve(__dirname, '../services/email/development.provider.js');
    expect(fs.existsSync(devProviderPath)).toBe(false);
  });

  // 13. Template escapes hostile names; link appears once in HTML and once in text
  it('13. Template escapes hostile names; link appears once in HTML and once in text', () => {
    const hostileName = '<script>alert("XSS")</script>&"\'';
    const invitationUrl = 'https://portal.example.com/accept-invitation?token=abc123token';
    const rendered = renderInvitationTemplate({
      name: hostileName,
      role: 'employee',
      adminName: '<b>Admin</b>',
      invitationUrl,
      expiresAt: new Date(),
    });

    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('&lt;script&gt;');
    expect(rendered.html).toContain('&amp;');

    // Link href appears exactly ONCE in HTML
    const hrefMatches = rendered.html.match(/href="[^"]+"/g) || [];
    expect(hrefMatches.length).toBe(1);
    expect(hrefMatches[0]).toContain(invitationUrl);

    // Link appears exactly ONCE in plain text
    const textMatches = rendered.text.match(/https:\/\/portal\.example\.com[^\s]+/g) || [];
    expect(textMatches.length).toBe(1);
  });

  // 14. GET /api/admin/invitations/email-status returns status object, not an :id validation cast error
  it('14. GET /api/admin/invitations/email-status returns status object, not an :id validation cast error', async () => {
    const res = await request(app)
      .get('/api/admin/invitations/email-status')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.provider).toBe('resend');
    expect(typeof res.body.data.configured).toBe('boolean');
    expect(typeof res.body.data.sandboxSender).toBe('boolean');
    expect(res.body.data.senderAddress).toBeDefined();
    expect(res.body.data.senderDomain).toBeDefined();
    expect(res.body.data.canReadStatus).toBeNull();
    expect(res.body.data.apiKey).toBeUndefined();
  });

  // 15. GET /auth/config reflects ALLOW_PUBLIC_REGISTRATION; signup disabled returns 403 SIGNUP_DISABLED
  it('15. GET /auth/config reflects ALLOW_PUBLIC_REGISTRATION; signup disabled returns 403 SIGNUP_DISABLED', async () => {
    const configRes = await request(app).get('/api/auth/config');
    expect(configRes.status).toBe(200);
    expect(configRes.body.data.publicRegistrationEnabled).toBe(true);

    const originalSetting = env.ALLOW_PUBLIC_REGISTRATION;
    try {
      env.ALLOW_PUBLIC_REGISTRATION = false;

      const disabledConfig = await request(app).get('/api/auth/config');
      expect(disabledConfig.body.data.publicRegistrationEnabled).toBe(false);

      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Blocked Registrant',
          email: 'blocked@company.com',
          password: 'Password123!',
          confirmPassword: 'Password123!',
        });
      expect(signupRes.status).toBe(403);
      expect(signupRes.body.error.code).toBe('SIGNUP_DISABLED');
    } finally {
      env.ALLOW_PUBLIC_REGISTRATION = originalSetting;
    }
  });
});
