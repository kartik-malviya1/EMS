import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export const originCheck = (req, _res, next) => {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  const origin = req.headers.origin;
  if (!origin) {
    // If no Origin header (e.g., server-to-server or same-origin non-cross-site in some clients), proceed
    return next();
  }

  const cleanOrigin = origin.replace(/\/+$/, '');
  const rawAllowed = env.CLIENT_ORIGIN || 'http://localhost:5173';
  const allowedList = rawAllowed
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const isDevAllowed =
    env.NODE_ENV !== 'production' &&
    (cleanOrigin === 'http://localhost:5173' || cleanOrigin === 'http://127.0.0.1:5173');

  const isVercelAllowed = cleanOrigin.endsWith('.vercel.app');

  if (!allowedList.includes(cleanOrigin) && !isDevAllowed && !isVercelAllowed) {
    return next(new ApiError(403, 'BAD_ORIGIN', 'Origin not permitted'));
  }

  next();
};

export default originCheck;
