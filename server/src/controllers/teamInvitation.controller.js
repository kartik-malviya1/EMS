import {
  createTeamInvitation,
  listTeamInvitations,
  getTeamInvitationById,
  resendTeamInvitation,
  revokeTeamInvitation,
  checkTeamInvitationDelivery,
} from '../services/invitation.service.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const create = asyncHandler(async (req, res) => {
  const result = await createTeamInvitation({
    managerUser: req.user,
    data: req.body,
    req,
  });
  return sendSuccess(res, result, 201);
});

export const list = asyncHandler(async (req, res) => {
  const { invitations, meta } = await listTeamInvitations({
    managerUser: req.user,
    ...req.query,
  });
  return sendSuccess(res, invitations, 200, meta);
});

export const getById = asyncHandler(async (req, res) => {
  const invitation = await getTeamInvitationById({
    managerUser: req.user,
    id: req.params.id,
  });
  return sendSuccess(res, invitation, 200);
});

export const resend = asyncHandler(async (req, res) => {
  const result = await resendTeamInvitation({
    managerUser: req.user,
    invitationId: req.params.id,
    req,
  });
  return sendSuccess(res, result, 200);
});

export const revoke = asyncHandler(async (req, res) => {
  const result = await revokeTeamInvitation({
    managerUser: req.user,
    invitationId: req.params.id,
    req,
  });
  return sendSuccess(res, result, 200);
});

export const checkDelivery = asyncHandler(async (req, res) => {
  const result = await checkTeamInvitationDelivery({
    managerUser: req.user,
    invitationId: req.params.id,
  });
  return sendSuccess(res, result, 200);
});

