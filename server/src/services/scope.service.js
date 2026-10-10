import { ROLES } from '../config/constants.js';
import { User } from '../models/user.model.js';

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

export default {
  buildScopeFilter,
  canAccessEmployee,
};
