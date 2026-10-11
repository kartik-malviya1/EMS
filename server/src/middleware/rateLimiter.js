import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { sendError } from '../utils/response.js';

const rateLimitHandler = (_req, res) => {
  return sendError(res, 'RATE_LIMITED', 'Too many requests, please try again later', 429);
};

export const shouldBypassRateLimit = () => {
  if (process.env.TEST_ENABLE_RATE_LIMITS === 'true') {
    return false;
  }
  return process.env.NODE_ENV === 'test' || env.NODE_ENV === 'test';
};

const wrapLimiter = (limiter) => (req, res, next) => {
  if (shouldBypassRateLimit()) {
    return next();
  }
  return limiter(req, res, next);
};

export const globalLimiter = wrapLimiter(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
  })
);

export const signupLimiter = wrapLimiter(
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
  })
);

export const loginLimiter = wrapLimiter(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
    keyGenerator: (req) => {
      const email = req.body?.email ? String(req.body.email).toLowerCase() : '';
      return `${req.ip || 'ip'}_${email}`;
    },
    handler: rateLimitHandler,
  })
);

export const punchLimiter = wrapLimiter(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
    keyGenerator: (req) => {
      return req.user?._id?.toString() || req.ip || 'unknown';
    },
    handler: rateLimitHandler,
  })
);

export const adminInvitationSendLimiter = wrapLimiter(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
    keyGenerator: (req) => {
      return req.user?._id?.toString() || req.ip || 'unknown';
    },
    handler: rateLimitHandler,
  })
);

