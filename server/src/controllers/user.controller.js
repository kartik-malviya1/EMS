import {
  listUsers,
  listTeamMembers,
  listActiveManagers,
  getUserById,
  updateUser as updateUserService,
} from '../services/user.service.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getUsers = asyncHandler(async (req, res) => {
  const { users, meta } = await listUsers(req.query);
  return sendSuccess(res, users, 200, meta);
});

export const getTeam = asyncHandler(async (req, res) => {
  const members = await listTeamMembers(req.user._id, req.query);
  return sendSuccess(res, members, 200);
});

export const getManagers = asyncHandler(async (_req, res) => {
  const managers = await listActiveManagers();
  return sendSuccess(res, managers, 200);
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await getUserById(req.params.id);
  return sendSuccess(res, user, 200);
});

export const updateUser = asyncHandler(async (req, res) => {
  const updated = await updateUserService(req.user, req.params.id, req.body, req);
  return sendSuccess(res, updated, 200);
});

