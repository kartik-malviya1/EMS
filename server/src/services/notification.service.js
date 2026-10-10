import { logger } from '../utils/logger.js';

export const notifyVerificationReviewed = async ({ attendance, reviewer, status }) => {
  const recipientId = (attendance.employeeId?._id || attendance.employeeId).toString();
  logger.info(
    `[NOTIFICATION STUB] notifyVerificationReviewed: employee=${recipientId}, reviewer=${reviewer._id}, status=${status}`
  );
  return {
    type: status === 'valid' ? 'attendance_valid' : 'attendance_invalid',
    recipientId,
    data: { attendanceId: attendance._id.toString() },
  };
};

export const notifyOvertimeRequested = async ({
  attendance,
  employee,
  requestedMinutes,
  reason,
}) => {
  logger.info(
    `[NOTIFICATION STUB] notifyOvertimeRequested: employee=${employee._id}, requestedMinutes=${requestedMinutes}`
  );
  return {
    type: 'overtime_requested',
    requesterId: employee._id.toString(),
    data: { attendanceId: attendance._id.toString(), requestedMinutes, reason },
  };
};

export const notifyOvertimeReviewed = async ({ attendance, reviewer, decision }) => {
  const recipientId = (attendance.employeeId?._id || attendance.employeeId).toString();
  logger.info(
    `[NOTIFICATION STUB] notifyOvertimeReviewed: employee=${recipientId}, reviewer=${reviewer._id}, decision=${decision}`
  );
  return {
    type: decision === 'approved' ? 'overtime_approved' : 'overtime_rejected',
    recipientId,
    data: { attendanceId: attendance._id.toString() },
  };
};

export const notifyMissedPunchIn = async ({ user, workDate }) => {
  logger.info(`[NOTIFICATION STUB] notifyMissedPunchIn: user=${user._id}, workDate=${workDate}`);
  return {
    type: 'missed_punch_in',
    recipientId: user._id.toString(),
    data: { workDate },
  };
};

export const notifyMissedPunchOut = async ({ user, attendance }) => {
  logger.info(
    `[NOTIFICATION STUB] notifyMissedPunchOut: user=${user._id}, attendanceId=${attendance._id}`
  );
  return {
    type: 'missed_punch_out',
    recipientId: user._id.toString(),
    data: { attendanceId: attendance._id.toString() },
  };
};

export const notifyAutoClose = async ({ attendance }) => {
  logger.info(`[NOTIFICATION STUB] notifyAutoClose: attendanceId=${attendance._id}`);
  return {
    type: 'attendance_auto_closed',
    data: { attendanceId: attendance._id.toString() },
  };
};

export default {
  notifyVerificationReviewed,
  notifyOvertimeRequested,
  notifyOvertimeReviewed,
  notifyMissedPunchIn,
  notifyMissedPunchOut,
  notifyAutoClose,
};
