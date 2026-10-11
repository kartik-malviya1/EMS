import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ROLES, ACCOUNT_STATUS } from '../config/constants.js';
import { acceptInvitation } from './invitation.service.js';

// Pre-computed dummy hash with cost 12 to perform dummy comparison on unknown emails
const DUMMY_HASH = '$2a$12$e80y6fGq01nE47hF5389yeCjE4u1R7x7q/jF/oZzG1eO79r1Hw4bC';

export const createSessionToken = (userId) => {
  return jwt.sign(
    {
      sub: userId.toString(),
      purpose: 'session',
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN || '12h' }
  );
};

export const createSocketToken = (userId) => {
  return jwt.sign(
    {
      sub: userId.toString(),
      purpose: 'socket',
    },
    env.JWT_SECRET,
    { expiresIn: '60s' }
  );
};

export const getSessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
  path: '/',
  maxAge: 12 * 60 * 60 * 1000, // 12 hours
});

export const signupUser = async ({ name, email, password, invitationToken, req }) => {
  // If an invitation token is supplied, accept invitation and activate account
  if (invitationToken) {
    const acceptance = await acceptInvitation({
      rawToken: invitationToken,
      password,
      req,
    });
    const user = await User.findOne({ email: acceptance.email });
    const token = createSessionToken(user._id);
    return { user, token };
  }

  // Reject public registration when disabled
  if (!env.ALLOW_PUBLIC_REGISTRATION) {
    throw new ApiError(
      403,
      'SIGNUP_DISABLED',
      'Registration is invitation-only'
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new ApiError(409, 'CONFLICT', 'Email is already registered');
  }

  const passwordHash = await User.hashPassword(password);

  // Strict enforcement: public signup always creates an employee
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role: ROLES.EMPLOYEE,
    managerId: null,
    accountStatus: ACCOUNT_STATUS.ACTIVE,
    isActive: true,
  });

  const token = createSessionToken(user._id);

  return { user, token };
};

export const loginUser = async ({ email, password }) => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

  if (!user) {
    // Perform dummy comparison to prevent timing attacks
    await bcrypt.compare(password, DUMMY_HASH);
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // Users in 'invited' state (no password set yet) must behave like an unknown account
  if (user.accountStatus === ACCOUNT_STATUS.INVITED || !user.passwordHash) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (user.accountStatus === ACCOUNT_STATUS.SUSPENDED) {
    throw new ApiError(
      403,
      'ACCOUNT_SUSPENDED',
      'Account has been suspended. Please contact an administrator.'
    );
  }

  if (user.accountStatus === ACCOUNT_STATUS.DEACTIVATED || !user.isActive) {
    throw new ApiError(403, 'ACCOUNT_INACTIVE', 'Account is deactivated');
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const token = createSessionToken(user._id);

  return { user, token };
};
