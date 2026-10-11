import { User } from '../models/user.model.js';
import { Attendance } from '../models/attendance.model.js';
import { ROLES, WORKING_STATUS, ACCOUNT_STATUS, AUDIT_ACTIONS } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { logAuditEvent } from './audit.service.js';

export const listUsers = async ({
  role,
  accountStatus,
  search,
  isActive,
  managerId,
  page = 1,
  limit = 20,
}) => {
  const query = {};

  if (role) {
    query.role = role;
  }

  if (accountStatus) {
    query.accountStatus = accountStatus;
  }

  if (isActive !== undefined) {
    query.isActive = isActive;
  }

  if (managerId) {
    query.managerId = managerId;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { employeeId: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(query)
      .populate('managerId', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(query),
  ]);

  return {
    users,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const listTeamMembers = async (managerId) => {
  const members = await User.find({ managerId })
    .populate('managerId', 'name email')
    .sort({ name: 1 });
  return members;
};

export const listActiveManagers = async () => {
  const managers = await User.find({
    role: ROLES.MANAGER,
    isActive: true,
  })
    .select('_id name email role')
    .sort({ name: 1 });
  return managers;
};

export const getUserById = async (id) => {
  const user = await User.findById(id).populate('managerId', 'name email role');
  if (!user) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found');
  }
  return user;
};

export const updateUser = async (adminUser, targetUserId, updateData, req) => {
  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found');
  }

  const isSelf = adminUser._id.toString() === targetUserId.toString();

  // 1. Admin cannot change own role
  if (isSelf && updateData.role !== undefined && updateData.role !== targetUser.role) {
    throw new ApiError(400, 'CANNOT_CHANGE_OWN_ROLE', 'Admin cannot change own role');
  }

  // 2. Admin cannot deactivate or suspend self
  if (isSelf && (updateData.isActive === false || updateData.accountStatus === ACCOUNT_STATUS.DEACTIVATED || updateData.accountStatus === ACCOUNT_STATUS.SUSPENDED)) {
    throw new ApiError(400, 'CANNOT_DEACTIVATE_SELF', 'Admin cannot deactivate or suspend self');
  }

  const newRole = updateData.role !== undefined ? updateData.role : targetUser.role;
  const isTargetDeactivating =
    updateData.isActive === false ||
    updateData.accountStatus === ACCOUNT_STATUS.DEACTIVATED ||
    updateData.accountStatus === ACCOUNT_STATUS.SUSPENDED;

  // 3. Cannot demote/deactivate the last active admin
  if (
    targetUser.role === ROLES.ADMIN &&
    (newRole !== ROLES.ADMIN || isTargetDeactivating)
  ) {
    const activeAdminsCount = await User.countDocuments({
      role: ROLES.ADMIN,
      isActive: true,
    });
    if (activeAdminsCount <= 1) {
      throw new ApiError(
        409,
        'CANNOT_MODIFY_LAST_ADMIN',
        'Cannot demote or deactivate the last active administrator'
      );
    }
  }

  // 4. A manager with active team members cannot be demoted or deactivated
  if (
    targetUser.role === ROLES.MANAGER &&
    (newRole !== ROLES.MANAGER || isTargetDeactivating)
  ) {
    const activeTeamCount = await User.countDocuments({
      managerId: targetUserId,
      isActive: true,
    });
    if (activeTeamCount > 0) {
      throw new ApiError(
        409,
        'HAS_TEAM_MEMBERS',
        'Cannot demote or deactivate a manager with active team members'
      );
    }
  }

  // 5. Promoting someone to admin or deactivating them with an in_progress shift -> 409 OPEN_SHIFT
  if (
    (newRole === ROLES.ADMIN && targetUser.role !== ROLES.ADMIN) ||
    (isTargetDeactivating && targetUser.isActive === true)
  ) {
    const openShift = await Attendance.findOne({
      employeeId: targetUserId,
      workingStatus: WORKING_STATUS.IN_PROGRESS,
    });
    if (openShift) {
      throw new ApiError(
        409,
        'OPEN_SHIFT',
        'Cannot promote to admin or deactivate a user with an active in-progress shift'
      );
    }
  }

  // 6. Setting role to manager/admin forces managerId = null
  if (newRole === ROLES.MANAGER || newRole === ROLES.ADMIN) {
    updateData.managerId = null;
  }

  // 7. managerId validation for employee
  if (newRole === ROLES.EMPLOYEE && updateData.managerId !== undefined && updateData.managerId !== null) {
    if (updateData.managerId.toString() === targetUserId.toString()) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'User cannot be their own manager');
    }

    const assignedManager = await User.findById(updateData.managerId);
    if (!assignedManager || assignedManager.role !== ROLES.MANAGER || !assignedManager.isActive) {
      throw new ApiError(
        400,
        'INVALID_MANAGER',
        'managerId must reference an existing active manager'
      );
    }
  }

  // 8. employeeId uniqueness check if changing
  if (updateData.employeeId && updateData.employeeId.trim()) {
    const existingEmpId = await User.findOne({
      employeeId: updateData.employeeId.trim(),
      _id: { $ne: targetUserId },
    });
    if (existingEmpId) {
      throw new ApiError(409, 'EMPLOYEE_ID_EXISTS', 'An employee with this Employee ID already exists');
    }
    targetUser.employeeId = updateData.employeeId.trim();
  }

  // Track changes for audit logging
  const oldRole = targetUser.role;
  const oldManagerId = targetUser.managerId?.toString();
  const oldStatus = targetUser.accountStatus;

  // Apply updates
  if (updateData.name !== undefined) targetUser.name = updateData.name;
  if (updateData.role !== undefined) targetUser.role = updateData.role;
  if (updateData.department !== undefined) targetUser.department = updateData.department;
  if (updateData.designation !== undefined) targetUser.designation = updateData.designation;
  if (updateData.dateOfJoining !== undefined) {
    targetUser.dateOfJoining = updateData.dateOfJoining ? new Date(updateData.dateOfJoining) : null;
  }
  if (updateData.managerId !== undefined) targetUser.managerId = updateData.managerId;

  if (updateData.accountStatus !== undefined) {
    targetUser.accountStatus = updateData.accountStatus;
    targetUser.isActive = updateData.accountStatus === ACCOUNT_STATUS.ACTIVE;
  } else if (updateData.isActive !== undefined) {
    targetUser.isActive = updateData.isActive;
    targetUser.accountStatus = updateData.isActive ? ACCOUNT_STATUS.ACTIVE : ACCOUNT_STATUS.DEACTIVATED;
  }

  await targetUser.save();

  // Audit event logging
  if (updateData.role !== undefined && updateData.role !== oldRole) {
    await logAuditEvent({
      actor: adminUser,
      action: AUDIT_ACTIONS.ROLE_CHANGED,
      targetUser,
      metadata: { oldRole, newRole: updateData.role },
      req,
    });
  }

  if (updateData.managerId !== undefined && String(updateData.managerId) !== String(oldManagerId)) {
    await logAuditEvent({
      actor: adminUser,
      action: AUDIT_ACTIONS.MANAGER_CHANGED,
      targetUser,
      metadata: { oldManagerId, newManagerId: updateData.managerId },
      req,
    });
  }

  if (targetUser.accountStatus !== oldStatus) {
    let action = null;
    if (targetUser.accountStatus === ACCOUNT_STATUS.SUSPENDED) {
      action = AUDIT_ACTIONS.ACCOUNT_SUSPENDED;
    } else if (targetUser.accountStatus === ACCOUNT_STATUS.DEACTIVATED) {
      action = AUDIT_ACTIONS.ACCOUNT_DEACTIVATED;
    } else if (targetUser.accountStatus === ACCOUNT_STATUS.ACTIVE && oldStatus !== ACCOUNT_STATUS.INVITED) {
      action = AUDIT_ACTIONS.ACCOUNT_REACTIVATED;
    }
    if (action) {
      await logAuditEvent({
        actor: adminUser,
        action,
        targetUser,
        metadata: { oldStatus, newStatus: targetUser.accountStatus },
        req,
      });
    }
  }

  return User.findById(targetUserId).populate('managerId', 'name email role');
};

