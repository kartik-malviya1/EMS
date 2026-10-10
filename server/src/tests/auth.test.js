import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { User } from '../models/user.model.js';
import { env } from '../config/env.js';
import { ROLES } from '../config/constants.js';

describe('Authentication & RBAC', () => {
  const validSignupData = {
    name: 'Alice Employee',
    email: 'alice@example.com',
    password: 'Password123',
  };

  describe('POST /api/auth/signup', () => {
    it('creates a new user with employee role by default and sets httpOnly cookie', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(validSignupData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe(ROLES.EMPLOYEE);
      expect(res.body.data.email).toBe('alice@example.com');
      expect(res.body.data.name).toBe('Alice Employee');
      expect(res.body.data.passwordHash).toBeUndefined();

      // Check cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.startsWith('token='))).toBe(true);
      expect(cookies.some((c) => c.includes('HttpOnly'))).toBe(true);
    });

    it('rejects role field in payload with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          ...validSignupData,
          email: 'admin_try@example.com',
          role: 'admin',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('accepts exact browser client form payload with confirmPassword and Origin header', async () => {
      const clientFormPayload = {
        name: 'Browser User',
        email: 'browser_user@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      };

      const res = await request(app)
        .post('/api/auth/signup')
        .set('Origin', 'http://localhost:5173')
        .send(clientFormPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('browser_user@example.com');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('rejects duplicate email with 409 CONFLICT', async () => {
      await request(app).post('/api/auth/signup').send(validSignupData);

      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          ...validSignupData,
          email: 'ALICE@example.com', // different casing
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('enforces password policy (min 8 chars, letter + number)', async () => {
      // Too short
      let res = await request(app).post('/api/auth/signup').send({
        name: 'Bob Short',
        email: 'bob@example.com',
        password: 'Pass1',
      });
      expect(res.status).toBe(400);

      // Only letters
      res = await request(app).post('/api/auth/signup').send({
        name: 'Bob Letters',
        email: 'bob2@example.com',
        password: 'PasswordOnly',
      });
      expect(res.status).toBe(400);

      // Only numbers
      res = await request(app).post('/api/auth/signup').send({
        name: 'Bob Numbers',
        email: 'bob3@example.com',
        password: '1234567890',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/signup').send(validSignupData);
    });

    it('logs in successfully with valid credentials and sets cookie', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'alice@example.com',
        password: 'Password123',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('alice@example.com');
      expect(res.body.data.passwordHash).toBeUndefined();

      const cookies = res.headers['set-cookie'];
      expect(cookies.some((c) => c.startsWith('token='))).toBe(true);
    });

    it('returns generic 401 INVALID_CREDENTIALS for wrong password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'alice@example.com',
        password: 'WrongPassword123',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns same generic 401 INVALID_CREDENTIALS for non-existent email', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'Password123',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects deactivated user with 403 ACCOUNT_INACTIVE on login', async () => {
      await User.updateOne({ email: 'alice@example.com' }, { isActive: false });

      const res = await request(app).post('/api/auth/login').send({
        email: 'alice@example.com',
        password: 'Password123',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
    });
  });

  describe('GET /api/auth/me', () => {
    let authCookie;

    beforeEach(async () => {
      const signupRes = await request(app).post('/api/auth/signup').send(validSignupData);
      authCookie = signupRes.headers['set-cookie'];
    });

    it('returns 401 UNAUTHENTICATED when no token/cookie is provided', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns authenticated user data with valid session cookie', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('alice@example.com');
      expect(res.body.data.role).toBe(ROLES.EMPLOYEE);
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('returns 401 TOKEN_EXPIRED when session token has expired', async () => {
      const user = await User.findOne({ email: 'alice@example.com' });
      const expiredToken = jwt.sign(
        { sub: user._id.toString(), purpose: 'session' },
        env.JWT_SECRET,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`token=${expiredToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('returns 401 UNAUTHENTICATED when token purpose is not session (e.g. socket)', async () => {
      const user = await User.findOne({ email: 'alice@example.com' });
      const socketToken = jwt.sign(
        { sub: user._id.toString(), purpose: 'socket' },
        env.JWT_SECRET,
        { expiresIn: '60s' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`token=${socketToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects deactivated user with 403 ACCOUNT_INACTIVE on existing valid token', async () => {
      await User.updateOne({ email: 'alice@example.com' }, { isActive: false });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', authCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears session cookie on logout', async () => {
      const signupRes = await request(app).post('/api/auth/signup').send(validSignupData);
      const authCookie = signupRes.headers['set-cookie'];

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const cookies = res.headers['set-cookie'];
      expect(cookies.some((c) => c.startsWith('token=;'))).toBe(true);
    });
  });

  describe('GET /api/auth/socket-token', () => {
    it('generates a 60-second token with purpose "socket"', async () => {
      const signupRes = await request(app).post('/api/auth/signup').send(validSignupData);
      const authCookie = signupRes.headers['set-cookie'];

      const res = await request(app)
        .get('/api/auth/socket-token')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.socketToken).toBeDefined();
      expect(res.body.data.expiresIn).toBe(60);

      const decoded = jwt.verify(res.body.data.socketToken, env.JWT_SECRET);
      expect(decoded.purpose).toBe('socket');
    });
  });

  describe('CSRF Origin Check', () => {
    it('rejects POST request with unauthorized Origin header with 403 BAD_ORIGIN', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .set('Origin', 'https://malicious-site.com')
        .send(validSignupData);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_ORIGIN');
    });

    it('allows POST request with allowed Origin header', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .set('Origin', env.CLIENT_ORIGIN || 'http://localhost:5173')
        .send({
          ...validSignupData,
          email: 'valid_origin@example.com',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });
});
