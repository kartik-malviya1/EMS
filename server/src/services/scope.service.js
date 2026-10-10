import { ROLES } from '../config/constants.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Builds a query filter for scoping attendance, reports, exports, and dashboards.
 * - Admin: sees all ({})
 * - Manager: sees all team members where managerId === manager._id (isActive not required)
 * - Employee: sees only own records ({ employeeId: user._id })
 */
export const buildScopeFilter = async (user) => {
  if (!user) {
    throw new Error('User is required to build scope filter');
  }

  if (user.role === ROLES.ADMIN) {
    return {};
  }

  if (user.role === ROLES.MANAGER) {
    const teamMembers = await User.find({ managerId: user._id }).select('_id');
    const memberIds = teamMembers.map((m) => m._id);
    return { employeeId: { $in: memberIds } };
  }

  // Employee
  return { employeeId: user._id };
};

/**
 * Checks whether a given user has permission to access a specific employee's records.
 * - Admin: can access all employees
 * - Manager: can access employee if employee's managerId === manager._id
 * - Employee: can only access self (user._id === targetEmployeeId)
 */
export const canAccessEmployee = async (user, targetEmployeeId) => {
  if (!user || !targetEmployeeId) return false;

  const targetIdStr = targetEmployeeId._id
    ? targetEmployeeId._id.toString()
    : targetEmployeeId.toString();

  if (user.role === ROLES.ADMIN) {
    return true;
  }

  if (user.role === ROLES.MANAGER) {
    // If target is self
    if (user._id.toString() === targetIdStr) {
      return true;
    }
    // Check if target has managerId === user._id
    const targetUser = await User.findById(targetIdStr).select('managerId');
    if (!targetUser) return false;
    return targetUser.managerId?.toString() === user._id.toString();
  }

  // Employee: can only access self
  return user._id.toString() === targetIdStr;
};

/**
 * Determines whether a reviewer is allowed to review an attendance record (verification or overtime).
 * Rules:
 * - Nobody reviews their own record (403 FORBIDDEN)
 * - Employees cannot review (403 FORBIDDEN)
 * - Admins can review all (except self)
 * - Managers can only review direct reports (managerId === manager._id)
 * - Manager reviewing other manager/admin or out-of-scope employee returns 404 NOT_FOUND
 */
export const canReview = (reviewer, attendance, employee = null) => {
  if (!reviewer) {
    throw new Error('Reviewer is required');
  }

  const emp = employee || attendance.employeeId;
  const reviewerIdStr = reviewer._id.toString();
  const employeeIdStr = (emp?._id || emp).toString();

  // 1. No self-review regardless of role
  if (reviewerIdStr === employeeIdStr) {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot review your own attendance record');
  }

  // 2. Employee cannot review
  if (reviewer.role === ROLES.EMPLOYEE) {
    throw new ApiError(403, 'FORBIDDEN', 'Employees are not authorized to review attendance records');
  }

  // 3. Admin can review any employee/manager or another admin
  if (reviewer.role === ROLES.ADMIN) {
    return true;
  }

  // 4. Manager scope
  if (reviewer.role === ROLES.MANAGER) {
    // Managers cannot review other managers or admins -> 404 NOT_FOUND
    if (emp?.role === ROLES.MANAGER || emp?.role === ROLES.ADMIN) {
      throw new ApiError(404, 'NOT_FOUND', 'Attendance record not found');
    }

    const empManagerIdStr = emp?.managerId?._id
      ? emp.managerId._id.toString()
      : emp?.managerId?.toString();

    if (empManagerIdStr !== reviewerIdStr) {
      throw new ApiError(404, 'NOT_FOUND', 'Attendance record not found');
    }

    return true;
  }

  throw new ApiError(403, 'FORBIDDEN', 'Unauthorized to review');
};

export default {
  buildScopeFilter,
  canAccessEmployee,
  canReview,
};
