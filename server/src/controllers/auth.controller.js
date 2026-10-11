import {
  signupUser,
  loginUser,
  createSocketToken,
  getSessionCookieOptions,
} from '../services/auth.service.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

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
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  return sendSuccess(res, { message: 'Logged out successfully' }, 200);
});

export const getMe = asyncHandler(async (req, res) => {
  return sendSuccess(res, req.user, 200);
});

export const getSocketToken = asyncHandler(async (req, res) => {
  const socketToken = createSocketToken(req.user._id);
  return sendSuccess(res, { socketToken, expiresIn: 60 }, 200);
});

export const validateInvitation = asyncHandler(async (req, res) => {
  const { validateInvitationToken } = await import('../services/invitation.service.js');
  const metadata = await validateInvitationToken(req.body.token);
  return sendSuccess(res, metadata, 200);
});

export const acceptInvitationHandler = asyncHandler(async (req, res) => {
  const { acceptInvitation } = await import('../services/invitation.service.js');
  const result = await acceptInvitation({
    rawToken: req.body.token,
    password: req.body.password,
    req,
  });
  return sendSuccess(res, result, 200);
});

