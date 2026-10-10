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

  const allowedOrigin = env.CLIENT_ORIGIN || 'http://localhost:5173';
  if (origin !== allowedOrigin) {
    return next(new ApiError(403, 'BAD_ORIGIN', 'Origin not permitted'));
  }

  next();
};

export default originCheck;
