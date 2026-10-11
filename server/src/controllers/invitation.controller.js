import {
  createInvitation,
  listInvitations,
  getInvitationById,
  resendInvitation,
  revokeInvitation,
  validateInvitationToken,
  acceptInvitation,
} from '../services/invitation.service.js';
import { env, parseEmailAddress } from '../config/env.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const create = asyncHandler(async (req, res) => {
  const result = await createInvitation({
    adminUser: req.user,
    data: req.body,
    req,
  });
  return sendSuccess(res, result, 201);
});

export const list = asyncHandler(async (req, res) => {
  const { invitations, meta } = await listInvitations(req.query);
  return sendSuccess(res, invitations, 200, meta);
});

export const getEmailStatus = asyncHandler(async (_req, res) => {
  const parsedFrom = parseEmailAddress(env.EMAIL_FROM);
  const isConfigured = Boolean(
    env.RESEND_API_KEY &&
    env.RESEND_API_KEY.startsWith('re_') &&
    env.RESEND_API_KEY !== 're_xxxxxxxxx'
  );
  const senderDomain = parsedFrom.domain.toLowerCase();
  const sandboxSender = senderDomain === 'resend.dev';

  return sendSuccess(
    res,
    {
      mode: env.EMAIL_MODE,
      provider: env.EMAIL_PROVIDER,
      configured: isConfigured,
      senderAddress: parsedFrom.address,
      senderDomain: parsedFrom.domain,
      sandboxSender,
    },
    200
  );
});

export const getById = asyncHandler(async (req, res) => {
  const invitation = await getInvitationById(req.params.id);
  return sendSuccess(res, invitation, 200);
});

export const resend = asyncHandler(async (req, res) => {
  const result = await resendInvitation({
    adminUser: req.user,
    invitationId: req.params.id,
    req,
  });
  return sendSuccess(res, result, 200);
});

export const revoke = asyncHandler(async (req, res) => {
  const result = await revokeInvitation({
    adminUser: req.user,
    invitationId: req.params.id,
    req,
  });
  return sendSuccess(res, result, 200);
});

export const validateToken = asyncHandler(async (req, res) => {
  const metadata = await validateInvitationToken(req.body.token);
  return sendSuccess(res, metadata, 200);
});

export const accept = asyncHandler(async (req, res) => {
  const result = await acceptInvitation({
    rawToken: req.body.token,
    password: req.body.password,
    req,
  });
  return sendSuccess(res, result, 200);
});
