import {
  punchIn as punchInService,
  punchOut as punchOutService,
  getTodayAttendance as getTodayService,
  listAttendance as listAttendanceService,
  getAttendanceById as getAttendanceByIdService,
  getSelfieStreamData,
  reviewVerification as reviewVerificationService,
  requestOvertime as requestOvertimeService,
  reviewOvertime as reviewOvertimeService,
  listPendingOvertime as listPendingOvertimeService,
} from '../services/attendance.service.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const handlePunchIn = asyncHandler(async (req, res) => {
  const record = await punchInService({
    user: req.user,
    file: req.file,
    latitude: req.body.latitude,
    longitude: req.body.longitude,
    accuracy: req.body.accuracy,
  });
  return sendSuccess(res, record, 201);
});

export const handlePunchOut = asyncHandler(async (req, res) => {
  const record = await punchOutService({
    user: req.user,
    file: req.file,
    latitude: req.body.latitude,
    longitude: req.body.longitude,
    accuracy: req.body.accuracy,
  });
  return sendSuccess(res, record, 200);
});

export const getTodayAttendance = asyncHandler(async (req, res) => {
  const record = await getTodayService(req.user._id);
  return sendSuccess(res, record, 200);
});

export const getMyAttendance = asyncHandler(async (req, res) => {
  const result = await listAttendanceService(req.user, {
    ...req.query,
    userId: req.user._id,
  });
  return sendSuccess(res, result.records, 200, result.meta);
});

export const getTeamAttendance = asyncHandler(async (req, res) => {
  const result = await listAttendanceService(req.user, req.query);
  return sendSuccess(res, result.records, 200, result.meta);
});

export const getAllAttendance = asyncHandler(async (req, res) => {
  const result = await listAttendanceService(req.user, req.query);
  return sendSuccess(res, result.records, 200, result.meta);
});

export const getAttendanceRecord = asyncHandler(async (req, res) => {
  const record = await getAttendanceByIdService(req.user, req.params.id);
  return sendSuccess(res, record, 200);
});

export const streamSelfieImage = asyncHandler(async (req, res) => {
  const { buffer, mimeType } = await getSelfieStreamData(
    req.user,
    req.params.id,
    req.params.kind
  );

  res.set({
    'Content-Type': mimeType,
    'Cache-Control': 'private, max-age=300',
  });

  return res.send(buffer);
});

export const handleReviewVerification = asyncHandler(async (req, res) => {
  const record = await reviewVerificationService({
    user: req.user,
    attendanceId: req.params.id,
    status: req.body.status,
    remarks: req.body.remarks,
  });
  return sendSuccess(res, record, 200);
});

export const handleRequestOvertime = asyncHandler(async (req, res) => {
  const record = await requestOvertimeService({
    user: req.user,
    attendanceId: req.params.id,
    requestedMinutes: req.body.requestedMinutes,
    reason: req.body.reason,
  });
  return sendSuccess(res, record, 200);
});

export const handleReviewOvertime = asyncHandler(async (req, res) => {
  const record = await reviewOvertimeService({
    user: req.user,
    attendanceId: req.params.id,
    decision: req.body.decision,
    remarks: req.body.remarks,
  });
  return sendSuccess(res, record, 200);
});

export const handleListPendingOvertime = asyncHandler(async (req, res) => {
  const result = await listPendingOvertimeService(req.user, req.query);
  return sendSuccess(res, result.records, 200, result.meta);
});

