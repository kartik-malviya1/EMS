import crypto from 'crypto';
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

export const adminEmailTestLimiter = wrapLimiter(
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
    keyGenerator: (req) => {
      return req.user?._id?.toString() || req.ip || 'unknown';
    },
    handler: rateLimitHandler,
  })
);

export const adminMessageStatusLimiter = wrapLimiter(
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

export const requestLinkIpLimiter = wrapLimiter(
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
  })
);

const genericRequestLinkMessage =
  'If a pending invitation exists for this email, a new invitation link has been sent. Check your inbox and spam folder; it can take a few minutes.';

export const requestLinkEmailLimiter = wrapLimiter(
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 3,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
    keyGenerator: (req) => {
      const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : '';
      return crypto.createHash('sha256').update(email).digest('hex');
    },
    handler: (_req, res) => {
      // When throttled for the email key, return the same generic 200 to prevent enumeration
      return res.status(200).json({
        success: true,
        message: genericRequestLinkMessage,
      });
    },
  })
);

