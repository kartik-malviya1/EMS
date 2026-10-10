import { Attendance } from '../models/attendance.model.js';
import { User } from '../models/user.model.js';
import {
  ROLES,
  WORKING_STATUS,
  VERIFICATION_STATUS,
  OVERTIME_STATUS,
} from '../config/constants.js';
import { getWorkDate, nowInBusinessTime } from '../utils/time.js';

export const getDashboardSummary = async (user) => {
  const today = getWorkDate();

  // 1. Employee Dashboard
  if (user.role === ROLES.EMPLOYEE) {
    const thirtyDaysAgo = nowInBusinessTime()
      .minus({ days: 30 })
      .toFormat('yyyy-MM-dd');

    const records = await Attendance.find({
      employeeId: user._id,
      workDate: { $gte: thirtyDaysAgo, $lte: today },
    });

    let completedDays = 0;
    let incompleteDays = 0;
    let missedDays = 0;
    let totalWorkedMinutes = 0;
    let pendingOvertime = 0;
    let approvedOvertimeMinutes = 0;
    let invalidDays = 0;

    for (const r of records) {
      if (r.workingStatus === WORKING_STATUS.COMPLETED) completedDays++;
      if (r.workingStatus === WORKING_STATUS.INCOMPLETE) incompleteDays++;
      if (r.workingStatus === WORKING_STATUS.MISSED) missedDays++;
      if (r.workedMinutes) totalWorkedMinutes += r.workedMinutes;
      if (r.overtime?.status === OVERTIME_STATUS.PENDING) pendingOvertime++;
      if (r.overtime?.status === OVERTIME_STATUS.APPROVED) {
        approvedOvertimeMinutes += r.overtime.requestedMinutes || 0;
      }
      if (r.verification?.status === VERIFICATION_STATUS.INVALID) invalidDays++;
    }

    return {
      completedDays,
      incompleteDays,
      missedDays,
      totalWorkedMinutes,
      pendingOvertime,
      approvedOvertimeMinutes,
      invalidDays,
    };
  }

  // 2. Manager Dashboard
  if (user.role === ROLES.MANAGER) {
    const team = await User.find({ managerId: user._id });
    const teamIds = team.map((m) => m._id);
    const teamSize = team.length;

    const todayRecords = await Attendance.find({
      employeeId: { $in: teamIds },
      workDate: today,
    });

    let completed = 0;
    let incomplete = 0;
    const punchedIn = todayRecords.length;
    const notYetPunchedIn = Math.max(0, teamSize - punchedIn);

    for (const r of todayRecords) {
      if (r.workingStatus === WORKING_STATUS.COMPLETED) completed++;
      if (r.workingStatus === WORKING_STATUS.INCOMPLETE) incomplete++;
    }

    const pendingVerification = await Attendance.countDocuments({
      employeeId: { $in: teamIds },
      'verification.status': VERIFICATION_STATUS.PENDING,
      workingStatus: { $ne: WORKING_STATUS.IN_PROGRESS },
    });

    const pendingOvertime = await Attendance.countDocuments({
      employeeId: { $in: teamIds },
      'overtime.status': OVERTIME_STATUS.PENDING,
    });

    return {
      teamSize,
      punchedIn,
      notYetPunchedIn,
      completed,
      incomplete,
      pendingVerification,
      pendingOvertime,
    };
  }

  // 3. Admin Dashboard
  if (user.role === ROLES.ADMIN) {
    const allUsers = await User.find().select('role isActive');
    const totalUsers = { employee: 0, manager: 0, admin: 0 };
    let activeUsers = 0;

    for (const u of allUsers) {
      if (totalUsers[u.role] !== undefined) totalUsers[u.role]++;
      if (u.isActive) activeUsers++;
    }

    const todayRecords = await Attendance.find({ workDate: today });

    let completed = 0;
    let incomplete = 0;
    let missed = 0;
    const punchedIn = todayRecords.length;

    for (const r of todayRecords) {
      if (r.workingStatus === WORKING_STATUS.COMPLETED) completed++;
      if (r.workingStatus === WORKING_STATUS.INCOMPLETE) incomplete++;
      if (r.workingStatus === WORKING_STATUS.MISSED) missed++;
    }

    const pendingVerification = await Attendance.countDocuments({
      'verification.status': VERIFICATION_STATUS.PENDING,
      workingStatus: { $ne: WORKING_STATUS.IN_PROGRESS },
    });

    const pendingOvertime = await Attendance.countDocuments({
      'overtime.status': OVERTIME_STATUS.PENDING,
    });

    return {
      totalUsers,
      activeUsers,
      today: {
        punchedIn,
        completed,
        incomplete,
        missed,
        pendingVerification,
        pendingOvertime,
      },
    };
  }

  return {};
};
