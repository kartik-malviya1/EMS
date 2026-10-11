import {
  applyLeave,
  getMyLeaveRequests,
  getTeamLeaveRequests,
  getAllLeaveRequests,
  getLeaveRequestById,
  cancelLeaveRequest,
  reviewLeaveRequest,
} from '../services/leave.service.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const apply = asyncHandler(async (req, res) => {
  const result = await applyLeave({
    user: req.user,
    data: req.body,
    req,
  });
  return sendSuccess(res, result, 201);
});

export const getMyLeaves = asyncHandler(async (req, res) => {
  const { data, meta } = await getMyLeaveRequests(req.user._id, req.query);
  return sendSuccess(res, data, 200, meta);
});

export const getTeamLeaves = asyncHandler(async (req, res) => {
  const { data, meta } = await getTeamLeaveRequests(req.user, req.query);
  return sendSuccess(res, data, 200, meta);
});

export const getAllLeaves = asyncHandler(async (req, res) => {
  const { data, meta } = await getAllLeaveRequests(req.query);
  return sendSuccess(res, data, 200, meta);
});

export const getById = asyncHandler(async (req, res) => {
  const result = await getLeaveRequestById(req.params.id, req.user);
  return sendSuccess(res, result, 200);
});

export const cancel = asyncHandler(async (req, res) => {
  const result = await cancelLeaveRequest({
    leaveId: req.params.id,
    user: req.user,
    req,
  });
  return sendSuccess(res, result, 200);
});

export const review = asyncHandler(async (req, res) => {
  const result = await reviewLeaveRequest({
    leaveId: req.params.id,
    reviewerUser: req.user,
    action: req.body.action,
    remarks: req.body.remarks,
    req,
  });
  return sendSuccess(res, result, 200);
});

export default {
  apply,
  getMyLeaves,
  getTeamLeaves,
  getAllLeaves,
  getById,
  cancel,
  review,
};
