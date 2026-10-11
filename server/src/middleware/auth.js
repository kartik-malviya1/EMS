import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ACCOUNT_STATUS } from '../config/constants.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  let token = req.cookies?.token;

  // Fallback to Bearer authorization header if cookie is absent
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Fallback to query parameter for media streaming if cookie/header absent
  if (!token && req.query?.token) {
    token = req.query.token;
  }

  if (!token) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(401, 'TOKEN_EXPIRED', 'Session token has expired');
    }
    throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid authentication token');
  }

  if (decoded.purpose !== 'session') {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid token purpose');
  }

  const user = await User.findById(decoded.sub);
  if (!user) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'User no longer exists');
  }

  if (
    !user.isActive ||
    user.accountStatus === ACCOUNT_STATUS.SUSPENDED ||
    user.accountStatus === ACCOUNT_STATUS.DEACTIVATED ||
    user.accountStatus === ACCOUNT_STATUS.INVITED
  ) {
    throw new ApiError(403, 'ACCOUNT_INACTIVE', 'User account is deactivated');
  }

  req.user = user;
  next();
});

export const authorize = (...roles) => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'FORBIDDEN', 'Insufficient permissions'));
    }

    next();
  };
};

export const requireWorkforce = (req, _res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication required'));
  }

  if (req.user.role === 'admin') {
    return next(
      new ApiError(
        403,
        'ADMIN_NOT_ELIGIBLE',
        'Administrators are administrative-only and not eligible for workforce attendance actions'
      )
    );
  }

  next();
};

