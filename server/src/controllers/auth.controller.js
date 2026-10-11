import {
  signupUser,
  loginUser,
  createSocketToken,
  getSessionCookieOptions,
  getClearCookieOptions,
} from '../services/auth.service.js';
import {
  validateInvitationToken,
  acceptInvitation,
  processSelfServiceInvitationRequest,
} from '../services/invitation.service.js';
import { env } from '../config/env.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';

export const signup = asyncHandler(async (req, res) => {
  const { user, token } = await signupUser(req.body);
  res.cookie('token', token, getSessionCookieOptions());
  return sendSuccess(res, user, 201);
});

export const login = asyncHandler(async (req, res) => {
  const { user, token } = await loginUser(req.body);
  res.cookie('token', token, getSessionCookieOptions());
  return sendSuccess(res, user, 200);
});

export const logout = asyncHandler(async (_req, res) => {
  res.clearCookie('token', getClearCookieOptions());
  return sendSuccess(res, { message: 'Logged out successfully' }, 200);
});

export const getMe = asyncHandler(async (req, res) => {
  return sendSuccess(res, req.user, 200);
});

export const getSocketToken = asyncHandler(async (req, res) => {
  const socketToken = createSocketToken(req.user._id);
  return sendSuccess(res, { socketToken, expiresIn: 60 }, 200);
});

export const getAuthConfig = asyncHandler(async (_req, res) => {
  return sendSuccess(
    res,
    {
      publicRegistrationEnabled: Boolean(env.ALLOW_PUBLIC_REGISTRATION),
    },
    200
  );
});

export const requestInvitationLink = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Always respond immediately with generic 200 message to avoid user enumeration
  res.status(200).json({
    success: true,
    message:
      'If a pending invitation exists for this email, a new invitation link has been sent. Check your inbox and spam folder; it can take a few minutes.',
  });

  // Process in background via setImmediate so response time does not reveal existence
  setImmediate(async () => {
    try {
      await processSelfServiceInvitationRequest({ email, req });
    } catch (err) {
      logger.error('Background self-service invitation request failed:', err.message);
    }
  });
});

export const validateInvitation = asyncHandler(async (req, res) => {
  const metadata = await validateInvitationToken(req.body.token);
  return sendSuccess(res, metadata, 200);
});

export const acceptInvitationHandler = asyncHandler(async (req, res) => {
  const result = await acceptInvitation({
    rawToken: req.body.token,
    password: req.body.password,
    req,
  });
  return sendSuccess(res, result, 200);
});
