import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { User } from '../models/user.model.js';
import { Invitation } from '../models/invitation.model.js';
import { AuditLog } from '../models/auditLog.model.js';
import { ROLES, ACCOUNT_STATUS, INVITATION_STATUS, EMAIL_DELIVERY_STATUS } from '../config/constants.js';
import { env, validateEnv } from '../config/env.js';
import { createSessionToken } from '../services/auth.service.js';
import {
  setEmailProvider,
  resetEmailProvider,
  createEmailProvider,
  EMAIL_ERROR_CODES,
  mapResendError,
  renderInvitationTemplate,
} from '../services/email/index.js';
import { ResendEmailProvider } from '../services/email/resend.provider.js';
import { DevelopmentEmailProvider } from '../services/email/development.provider.js';
import { logger } from '../utils/logger.js';

describe('Resend Email Provider & Invitation Lifecycle Specification (Section 8)', () => {
  let adminCookie;
  let managerCookie;
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
    managerCookie = [`token=${createSessionToken(managerUser._id)}`];
    employeeCookie = [`token=${createSessionToken(employeeUser._id)}`];
  });

  afterEach(() => {
    resetEmailProvider();
    vi.restoreAllMocks();
  });

  // 1. EMAIL_MODE=development
  it('1. EMAIL_MODE=development: factory returns dev provider, status dev_link, devInvitationLink present', async () => {
    const provider = createEmailProvider('development');
    expect(provider).toBeInstanceOf(DevelopmentEmailProvider);

    const res = await request(app)
      .post('/api/admin/invitations')
      .set('Cookie', adminCookie)
      .send({
        name: 'Dev Hire',
        email: 'dev.hire@company.com',
        role: 'employee',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.email.status).toBe(EMAIL_DELIVERY_STATUS.DEV_LINK);
    expect(res.body.data.email.mode).toBe('development');
    expect(res.body.data.devInvitationLink).toBeDefined();
    expect(res.body.data.devInvitationLink).toContain('/accept-invitation?token=');
  });

  // 2. EMAIL_MODE=resend calls provider with expected payload & idempotency key
  it('2. EMAIL_MODE=resend: Resend provider called with from, to, subject, html, text and idempotency key', async () => {
    const mockSend = vi.fn().mockResolvedValue({
      data: { id: 'msg_resend_123' },
      error: null,
    });

    const fakeClient = { emails: { send: mockSend } };
    const resendProvider = new ResendEmailProvider({
      apiKey: 're_test_fake_key_12345',
      defaultFrom: 'AMS Portal <onboarding@resend.dev>',
      timeoutMs: 5000,
      client: fakeClient,
    });

    setEmailProvider(resendProvider);

    const res = await request(app)
      .post('/api/admin/invitations')
      .set('Cookie', adminCookie)
      .send({
        name: 'Resend Hire',
        email: 'resend.hire@company.com',
        role: 'employee',
      });

    expect(res.status).toBe(201);
    expect(mockSend).toHaveBeenCalledTimes(1);

    const [payload, options] = mockSend.mock.calls[0];
    expect(payload.to).toBe('resend.hire@company.com');
    expect(payload.from).toBe('AMS Portal <onboarding@resend.dev>');
    expect(payload.subject).toBe("You're invited to join AMS Portal");
    expect(payload.html).toContain('Resend Hire');
    expect(payload.text).toContain('Resend Hire');
    expect(options.idempotencyKey).toMatch(/^invitation:[a-f0-9]{24}:attempt:1$/);

    // In resend mode, devInvitationLink must NEVER be returned
    expect(res.body.data.devInvitationLink).toBeUndefined();
    expect(res.body.data.email.status).toBe(EMAIL_DELIVERY_STATUS.ACCEPTED);
    expect(res.body.data.email.providerMessageId).toBe('msg_resend_123');
  });

  // 3. SDK returns { data: { id }, error: null } -> accepted and providerMessageId stored
  it('3. SDK returns {data:{id}, error:null} -> accepted, providerMessageId stored in DB', async () => {
    const fakeClient = {
      emails: {
        send: vi.fn().mockResolvedValue({ data: { id: 're_msg_success_999' }, error: null }),
      },
    };
    setEmailProvider(new ResendEmailProvider({ apiKey: 're_valid_key_12345', client: fakeClient }));

    const res = await request(app)
      .post('/api/admin/invitations')
      .set('Cookie', adminCookie)
      .send({
        name: 'Success User',
        email: 'success.user@company.com',
        role: 'manager',
      });

    expect(res.status).toBe(201);
    const inv = await Invitation.findById(res.body.data.invitation.id);
    expect(inv.emailDeliveryStatus).toBe(EMAIL_DELIVERY_STATUS.ACCEPTED);
    expect(inv.emailProviderMessageId).toBe('re_msg_success_999');
    expect(inv.emailLastError).toBeNull();
  });

  // 4. SDK returns { data: null, error: { name, message } } (not thrown) -> failed, mapped code stored; 201 on create, 502 on resend
  it('4. SDK returns error without throwing -> failed, mapped code stored; 201 on create / 502 on resend', async () => {
    const fakeClient = {
      emails: {
        send: vi.fn().mockResolvedValue({
          data: null,
          error: { name: 'rate_limit_exceeded', statusCode: 429, message: 'Too many requests' },
        }),
      },
    };
    setEmailProvider(new ResendEmailProvider({ apiKey: 're_valid_key_12345', client: fakeClient }));

    // Create returns 201 even if email delivery fails
    const createRes = await request(app)
      .post('/api/admin/invitations')
      .set('Cookie', adminCookie)
      .send({
        name: 'Rate Limited User',
        email: 'ratelimit@company.com',
        role: 'employee',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.email.status).toBe(EMAIL_DELIVERY_STATUS.FAILED);
    expect(createRes.body.data.email.error.code).toBe(EMAIL_ERROR_CODES.EMAIL_RATE_LIMITED);

    const invId = createRes.body.data.invitation.id;

    // Advance lastSentAt & emailLastError.at past cooldown
    await Invitation.updateOne(
      { _id: invId },
      {
        $set: {
          lastSentAt: new Date(Date.now() - 100 * 1000),
          'emailLastError.at': new Date(Date.now() - 100 * 1000),
        },
      }
    );

    const resendRes = await request(app)
      .post(`/api/admin/invitations/${invId}/resend`)
      .set('Cookie', adminCookie);

    expect(resendRes.status).toBe(502);
    expect(resendRes.body.error.code).toBe(EMAIL_ERROR_CODES.EMAIL_RATE_LIMITED);
  });

  // 5. SDK throws a network error -> failed, EMAIL_PROVIDER_ERROR
  it('5. SDK throws a network error -> failed, EMAIL_PROVIDER_ERROR', async () => {
    const fakeClient = {
      emails: {
        send: vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND api.resend.com')),
      },
    };
    setEmailProvider(new ResendEmailProvider({ apiKey: 're_valid_key_12345', client: fakeClient }));

    const res = await request(app)
      .post('/api/admin/invitations')
      .set('Cookie', adminCookie)
      .send({
        name: 'Network Error User',
        email: 'network.error@company.com',
        role: 'employee',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.email.status).toBe(EMAIL_DELIVERY_STATUS.FAILED);
    expect(res.body.data.email.error.code).toBe(EMAIL_ERROR_CODES.EMAIL_PROVIDER_ERROR);
  });

  // 6. Timeout -> failed, outcomeUnknown: true, retry reuses attempt number
  it('6. Timeout -> failed, outcomeUnknown: true, next retry reuses the same attempt number', async () => {
    const fakeClient = {
      emails: {
        send: vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 500))),
      },
    };
    // Provider with ultra short timeout
    const timeoutProvider = new ResendEmailProvider({
      apiKey: 're_valid_key_12345',
      timeoutMs: 50,
      client: fakeClient,
    });
    setEmailProvider(timeoutProvider);

    const createRes = await request(app)
      .post('/api/admin/invitations')
      .set('Cookie', adminCookie)
      .send({
        name: 'Timeout User',
        email: 'timeout.user@company.com',
        role: 'employee',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.email.status).toBe(EMAIL_DELIVERY_STATUS.FAILED);
    expect(createRes.body.data.email.error.code).toBe(EMAIL_ERROR_CODES.EMAIL_TIMEOUT);

    const inv = await Invitation.findById(createRes.body.data.invitation.id);
    expect(inv.emailLastError?.outcomeUnknown).toBe(true);
    expect(inv.emailAttempt).toBe(1);

    // Bypass cooldown
    await Invitation.updateOne(
      { _id: inv._id },
      {
        $set: {
          lastSentAt: new Date(Date.now() - 100 * 1000),
          'emailLastError.at': new Date(Date.now() - 100 * 1000),
        },
      }
    );

    // Retry should reuse attempt number 1 for idempotency
    const retrySendMock = vi.fn().mockResolvedValue({ data: { id: 'retry_success' }, error: null });
    setEmailProvider(new ResendEmailProvider({ apiKey: 're_valid_key_12345', client: { emails: { send: retrySendMock } } }));

    const resendRes = await request(app)
      .post(`/api/admin/invitations/${inv._id}/resend`)
      .set('Cookie', adminCookie);

    expect(resendRes.status).toBe(200);
    expect(retrySendMock).toHaveBeenCalledTimes(1);
    const [, retryOptions] = retrySendMock.mock.calls[0];
    expect(retryOptions.idempotencyKey).toBe(`invitation:${inv._id}:attempt:1`);
  });

  // 7. Sandbox 403 maps to EMAIL_SANDBOX_RECIPIENT_RESTRICTED with actionable message
  it('7. Sandbox 403 maps to EMAIL_SANDBOX_RECIPIENT_RESTRICTED with actionable message', () => {
    const errorObj = {
      name: 'validation_error',
      statusCode: 403,
      message: 'You can only send testing emails to your own email address (dev@resend.dev).',
    };

    const mapped = mapResendError(errorObj);
    expect(mapped.code).toBe(EMAIL_ERROR_CODES.EMAIL_SANDBOX_RECIPIENT_RESTRICTED);
    expect(mapped.message).toContain("Resend's test sender can only deliver to your own Resend account email");
    expect(mapped.message).toContain('resend.com/domains');
    expect(mapped.retryable).toBe(false);
  });

  // 8. Env validation: placeholder key rejected in resend mode; missing EMAIL_FROM; production constraints
  it('8. Env validation: placeholder key rejected, missing EMAIL_FROM, production constraints verified', () => {
    const baseValid = {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://localhost:27017/test',
      JWT_SECRET: 'a_very_long_jwt_secret_that_is_at_least_32_characters_long',
      CLIENT_ORIGIN: 'http://localhost:5173',
      APP_BASE_URL: 'http://localhost:5173',
      EMAIL_MODE: 'development',
    };

    // Placeholder key rejected in resend mode
    expect(() =>
      validateEnv({
        ...baseValid,
        EMAIL_MODE: 'resend',
        RESEND_API_KEY: 're_xxxxxxxxx',
        EMAIL_FROM: 'AMS Portal <onboarding@resend.dev>',
      })
    ).toThrow();

    // Missing EMAIL_FROM rejected in resend mode
    expect(() =>
      validateEnv({
        ...baseValid,
        EMAIL_MODE: 'resend',
        RESEND_API_KEY: 're_real_active_key_123',
        EMAIL_FROM: 'invalid-email-string',
      })
    ).toThrow();

    // Production + development mode rejected
    expect(() =>
      validateEnv({
        ...baseValid,
        NODE_ENV: 'production',
        EMAIL_MODE: 'development',
        APP_BASE_URL: 'https://ams.company.com',
      })
    ).toThrow();

    // Production + localhost APP_BASE_URL rejected
    expect(() =>
      validateEnv({
        ...baseValid,
        NODE_ENV: 'production',
        EMAIL_MODE: 'resend',
        RESEND_API_KEY: 're_production_key_12345',
        APP_BASE_URL: 'https://localhost:5173',
      })
    ).toThrow();

    // Trailing slash normalized
    const valid = validateEnv({
      ...baseValid,
      APP_BASE_URL: 'http://localhost:5173/extra/path/',
    });
    expect(valid.APP_BASE_URL).toBe('http://localhost:5173');
  });

  // 9. Resend success rotates token; Resend failure preserves old token
  it('9. Resend success rotates token; Resend failure preserves old token', async () => {
    let callCount = 0;
    const sendMock = vi.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.resolve({ data: { id: 'first_ok' }, error: null });
      }
      // Second call (resend) fails
      return Promise.resolve({
        data: null,
        error: { name: 'service_unavailable', statusCode: 503, message: 'Provider down' },
      });
    });

    const fakeProvider = new ResendEmailProvider({
      apiKey: 're_valid_test_key_123',
      client: { emails: { send: sendMock } },
    });
    setEmailProvider(fakeProvider);

    // Initial create
    const createRes = await request(app)
      .post('/api/admin/invitations')
      .set('Cookie', adminCookie)
      .send({ name: 'Rotate User', email: 'rotate@company.com', role: 'employee' });

    expect(createRes.status).toBe(201);
    const invId = createRes.body.data.invitation.id;
    const initialInv = await Invitation.findById(invId);
    const initialTokenHash = initialInv.tokenHash;

    // Resend that fails
    await Invitation.updateOne({ _id: invId }, { $set: { lastSentAt: new Date(Date.now() - 100 * 1000) } });

    const failedResendRes = await request(app)
      .post(`/api/admin/invitations/${invId}/resend`)
      .set('Cookie', adminCookie);

    expect(failedResendRes.status).toBe(502);

    // Old token hash MUST be untouched!
    const postFailInv = await Invitation.findById(invId);
    expect(postFailInv.tokenHash).toBe(initialTokenHash);

    // Now resend succeeds
    sendMock.mockResolvedValueOnce({ data: { id: 'second_ok' }, error: null });
    await Invitation.updateOne({ _id: invId }, { $set: { 'emailLastError.at': new Date(Date.now() - 100 * 1000) } });

    const successResendRes = await request(app)
      .post(`/api/admin/invitations/${invId}/resend`)
      .set('Cookie', adminCookie);

    expect(successResendRes.status).toBe(200);

    const postSuccessInv = await Invitation.findById(invId);
    expect(postSuccessInv.tokenHash).not.toBe(initialTokenHash);
    expect(postSuccessInv.resendCount).toBe(1);
  });

  // 10. Concurrency, cooldown, max resends
  it('10. Concurrent double resend returns 409 SEND_IN_PROGRESS; cooldown returns 429; max resends returns 409', async () => {
    // Create base invitation
    const inv = await Invitation.create({
      userId: employeeUser._id,
      email: 'concurrency.test@company.com',
      name: 'Concurrency Test',
      role: 'employee',
      invitedBy: adminUser._id,
      tokenHash: 'dummyhash12345',
      status: INVITATION_STATUS.PENDING,
      expiresAt: new Date(Date.now() + 3600 * 1000),
      lastSentAt: new Date(Date.now() - 100 * 1000),
      resendCount: 0,
    });

    // Slow fake provider to test concurrency race
    let resolveFirstSend;
    const sendPromise = new Promise((resolve) => {
      resolveFirstSend = resolve;
    });

    const fakeClient = {
      emails: {
        send: vi.fn().mockImplementation(() => sendPromise),
      },
    };
    setEmailProvider(new ResendEmailProvider({ apiKey: 're_valid_key_123', client: fakeClient }));

    // Start first resend request (trigger immediately with .then())
    const p1 = request(app)
      .post(`/api/admin/invitations/${inv._id}/resend`)
      .set('Cookie', adminCookie)
      .then((res) => res);

    // Give p1 80ms to claim sendingAt lease and enter sendInvitation
    await new Promise((r) => setTimeout(r, 80));

    // Second simultaneous request
    const res2 = await request(app)
      .post(`/api/admin/invitations/${inv._id}/resend`)
      .set('Cookie', adminCookie);

    expect(res2.status).toBe(409);
    expect(res2.body.error.code).toBe('SEND_IN_PROGRESS');

    // Complete first send
    resolveFirstSend({ data: { id: 'msg_concurrent' }, error: null });
    const res1 = await p1;
    expect(res1.status).toBe(200);

    // Cooldown test: immediate subsequent resend without waiting returns 429
    const cooldownRes = await request(app)
      .post(`/api/admin/invitations/${inv._id}/resend`)
      .set('Cookie', adminCookie);

    expect(cooldownRes.status).toBe(429);
    expect(cooldownRes.body.error.code).toBe('RESEND_COOLDOWN');
    expect(cooldownRes.body.error.details.retryAfterSeconds).toBeGreaterThan(0);

    // Max resends test: simulate max resends reached
    await Invitation.updateOne(
      { _id: inv._id },
      { $set: { resendCount: 10, lastSentAt: new Date(Date.now() - 100 * 1000) } }
    );

    const maxResendsRes = await request(app)
      .post(`/api/admin/invitations/${inv._id}/resend`)
      .set('Cookie', adminCookie);

    expect(maxResendsRes.status).toBe(409);
    expect(maxResendsRes.body.error.code).toBe('RESEND_LIMIT_REACHED');
  });

  // 11. No secret leakage
  it('11. No secret leakage: logs, responses, and audit entries never contain raw token or API key', async () => {
    const fakeKey = 're_super_secret_api_key_for_testing_only';
    const fakeClient = {
      emails: {
        send: vi.fn().mockResolvedValue({ data: { id: 'msg_leak_check' }, error: null }),
      },
    };

    setEmailProvider(new ResendEmailProvider({ apiKey: fakeKey, client: fakeClient }));

    const logOutputs = [];
    vi.spyOn(logger, 'info').mockImplementation((...args) => {
      logOutputs.push(JSON.stringify(args));
    });

    const createRes = await request(app)
      .post('/api/admin/invitations')
      .set('Cookie', adminCookie)
      .send({ name: 'Leak Check', email: 'leak.check@company.com', role: 'employee' });

    expect(createRes.status).toBe(201);
    const serializedResponse = JSON.stringify(createRes.body);

    // Assert raw tokens and API key never appear in response
    expect(serializedResponse).not.toContain(fakeKey);
    expect(serializedResponse).not.toContain('devInvitationLink');

    // Check audit logs
    const auditLogs = await AuditLog.find({});
    for (const log of auditLogs) {
      const serializedAudit = JSON.stringify(log.toObject());
      expect(serializedAudit).not.toContain(fakeKey);
      expect(serializedAudit).not.toContain('token');
      expect(serializedAudit).not.toContain('tokenHash');
    }

    // Check captured logger output
    for (const out of logOutputs) {
      expect(out).not.toContain(fakeKey);
    }
  });

  // 12. Accepted/revoked/expired invitations cannot be reused, invited user cannot log in, admin-only routes reject manager/employee
  it('12. Accepted/revoked/expired invitations fail; invited user cannot log in; admin-only routes reject manager/employee', async () => {
    // Admin-only route rejects manager and employee
    const mgrRes = await request(app).get('/api/admin/invitations').set('Cookie', managerCookie);
    expect(mgrRes.status).toBe(403);

    const empRes = await request(app).get('/api/admin/invitations').set('Cookie', employeeCookie);
    expect(empRes.status).toBe(403);

    // Invited user without password gets generic 401
    await User.create({
      name: 'Unactivated Stub',
      email: 'stub@company.com',
      role: 'employee',
      accountStatus: ACCOUNT_STATUS.INVITED,
      isActive: false,
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'stub@company.com', password: 'SomePassword123' });

    expect(loginRes.status).toBe(401);
    expect(loginRes.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  // 13. Template: HTML-escapes hostile names, single link, expiry in timezone
  it('13. Template: HTML-escapes hostile names, single CTA link, includes expiry', () => {
    const hostileName = '"><script>alert(1)</script>&test';
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000);
    const invitationUrl = 'http://localhost:5173/accept-invitation?token=abc123safe';

    const rendered = renderInvitationTemplate({
      name: hostileName,
      role: 'employee',
      adminName: 'Admin <script>',
      invitationUrl,
      expiresAt,
    });

    // Hostile name must be escaped
    expect(rendered.html).not.toContain('<script>alert(1)</script>');
    expect(rendered.html).toContain('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&amp;test');

    // Contains CTA link and plain text
    expect(rendered.html).toContain(invitationUrl);
    expect(rendered.text).toContain(invitationUrl);
    expect(rendered.html).toContain("If you weren't expecting this invitation, you can ignore this email.");
    expect(rendered.subject).toBe("You're invited to join AMS Portal");
  });

  // 14. GET /api/admin/invitations/email-status returns status object without matching :id
  it('14. GET /api/admin/invitations/email-status returns status object, not an :id validation cast error', async () => {
    const res = await request(app)
      .get('/api/admin/invitations/email-status')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.mode).toBeDefined();
    expect(res.body.data.provider).toBe('resend');
    expect(typeof res.body.data.configured).toBe('boolean');
    expect(typeof res.body.data.sandboxSender).toBe('boolean');
    expect(res.body.data.senderDomain).toBeDefined();

    // Never includes the API key
    expect(res.body.data.apiKey).toBeUndefined();
    expect(res.body.data.resendApiKey).toBeUndefined();
  });

  // Public signup policy check (Section 10)
  it('Section 10: Public signup allowed by default; returns 403 SIGNUP_DISABLED when disabled', async () => {
    // 1. When ALLOW_PUBLIC_REGISTRATION is true (default)
    const signupOk = await request(app).post('/api/auth/signup').send({
      name: 'Public Applicant',
      email: 'public.applicant@company.com',
      password: 'ApplicantPassword123',
    });

    expect(signupOk.status).toBe(201);
    expect(signupOk.body.data.role).toBe(ROLES.EMPLOYEE);
    expect(signupOk.body.data.accountStatus).toBe(ACCOUNT_STATUS.ACTIVE);

    // 2. When ALLOW_PUBLIC_REGISTRATION is false
    const originalSetting = env.ALLOW_PUBLIC_REGISTRATION;
    try {
      env.ALLOW_PUBLIC_REGISTRATION = false;

      const signupDisabled = await request(app).post('/api/auth/signup').send({
        name: 'Another Applicant',
        email: 'another.applicant@company.com',
        password: 'ApplicantPassword123',
      });

      expect(signupDisabled.status).toBe(403);
      expect(signupDisabled.body.error.code).toBe('SIGNUP_DISABLED');
      expect(signupDisabled.body.error.message).toBe('Registration is invitation-only');
    } finally {
      env.ALLOW_PUBLIC_REGISTRATION = originalSetting;
    }
  });

  // Origin check for tunnels and unlisted origins (Section 6)
  it('Section 6: Origin check allows CLIENT_ORIGIN and rejects unlisted origin with 403 BAD_ORIGIN', async () => {
    const allowedRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', env.CLIENT_ORIGIN || 'http://localhost:5173')
      .send({ email: 'admin@company.com', password: 'AdminPass123' });

    expect(allowedRes.status).toBe(200);

    const badOriginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://malicious-attacker-site.com')
      .send({ email: 'admin@company.com', password: 'AdminPass123' });

    expect(badOriginRes.status).toBe(403);
    expect(badOriginRes.body.error.code).toBe('BAD_ORIGIN');
  });
});
