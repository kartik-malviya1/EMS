import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { sendError } from '../utils/response.js';

const isTest = env.NODE_ENV === 'test';

const rateLimitHandler = (_req, res) => {
  return sendError(res, 'RATE_LIMITED', 'Too many requests, please try again later', 429);
};

export const globalLimiter = isTest
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
      handler: rateLimitHandler,
    });

export const signupLimiter = isTest
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 60 * 60 * 1000,
      limit: 5,
      standardHeaders: true,
      legacyHeaders: false,
      handler: rateLimitHandler,
    });

export const loginLimiter = isTest
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        const email = req.body?.email ? String(req.body.email).toLowerCase() : '';
        return `${req.ip || 'ip'}_${email}`;
      },
      handler: rateLimitHandler,
    });

export const punchLimiter = isTest
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        return req.user?._id?.toString() || req.ip || 'unknown';
      },
      handler: rateLimitHandler,
    });
