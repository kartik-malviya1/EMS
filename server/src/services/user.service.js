import { User } from '../models/user.model.js';
import { Attendance } from '../models/attendance.model.js';
import { Invitation } from '../models/invitation.model.js';
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

  const invitedUserIds = users
    .filter((u) => u.accountStatus === ACCOUNT_STATUS.INVITED)
    .map((u) => u._id);

  const invitationMap = new Map();
  if (invitedUserIds.length > 0) {
    const invitations = await Invitation.find({ userId: { $in: invitedUserIds } })
      .populate('invitedBy', 'name email role')
      .sort({ createdAt: -1 });

    for (const inv of invitations) {
      const uid = inv.userId.toString();
      if (!invitationMap.has(uid)) {
        invitationMap.set(uid, inv);
      }
    }
  }

  const safeUsers = users.map((u) => {
    const userObj = u.toObject ? u.toObject() : { ...u };
    if (u.accountStatus === ACCOUNT_STATUS.INVITED && invitationMap.has(u._id.toString())) {
      const inv = invitationMap.get(u._id.toString());
      userObj.invitedBy = inv.invitedBy
        ? {
            id: (inv.invitedBy._id || inv.invitedBy.id || inv.invitedBy).toString(),
            name: inv.invitedBy.name || '',
            role: inv.invitedByRole || inv.invitedBy.role || 'admin',
          }
        : null;
      userObj.invitationSummary = {
        id: inv._id.toString(),
        status: inv.status,
        emailDeliveryStatus: inv.emailDeliveryStatus,
        expiresAt: inv.expiresAt,
        lastSentAt: inv.lastSentAt,
        resendCount: inv.resendCount,
        emailLastEvent: inv.emailLastEvent,
      };
    }
    return userObj;
  });

  return {
    users: safeUsers,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const listTeamMembers = async (managerId, { status } = {}) => {
  const query = {
    managerId,
    accountStatus: { $ne: ACCOUNT_STATUS.DEACTIVATED },
  };

  if (status) {
    query.accountStatus = status;
  }

  const members = await User.find(query)
    .populate('managerId', 'name email role')
    .sort({ name: 1 });

  const invitedIds = members
    .filter((m) => m.accountStatus === ACCOUNT_STATUS.INVITED)
    .map((m) => m._id);

  const invitationMap = new Map();
  if (invitedIds.length > 0) {
    const invitations = await Invitation.find({ userId: { $in: invitedIds } })
      .populate('invitedBy', 'name email role')
      .sort({ createdAt: -1 });

    for (const inv of invitations) {
      const uid = inv.userId.toString();
      if (!invitationMap.has(uid)) {
        invitationMap.set(uid, inv);
      }
    }
  }

  return members.map((m) => {
    const memberObj = m.toObject ? m.toObject() : { ...m };
    if (m.accountStatus === ACCOUNT_STATUS.INVITED) {
      memberObj.statusLabel = 'Invited — pending activation';
      const inv = invitationMap.get(m._id.toString());
      memberObj.invitationSummary = inv
        ? {
            id: inv._id.toString(),
            status: inv.status,
            emailDeliveryStatus: inv.emailDeliveryStatus,
            expiresAt: inv.expiresAt,
            lastSentAt: inv.lastSentAt,
            resendCount: inv.resendCount,
            emailLastEvent: inv.emailLastEvent,
          }
        : null;
    }
    return memberObj;
  });
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

  // Admin role cannot be granted or removed via the API
  if (updateData.role !== undefined && updateData.role !== targetUser.role) {
    if (targetUser.role === ROLES.ADMIN || updateData.role === ROLES.ADMIN) {
      throw new ApiError(
        400,
        'CANNOT_MODIFY_ADMIN_ROLE',
        'Admin role cannot be granted or removed via the API'
      );
    }
    if (
      !(
        (targetUser.role === ROLES.EMPLOYEE && updateData.role === ROLES.MANAGER) ||
        (targetUser.role === ROLES.MANAGER && updateData.role === ROLES.EMPLOYEE)
      )
    ) {
      throw new ApiError(
        400,
        'INVALID_ROLE_CHANGE',
        'Roles may only be changed between employee and manager'
      );
    }
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

  // 4. A manager with non-deactivated team members (active, invited, suspended) cannot be demoted, suspended, or deactivated
  if (
    targetUser.role === ROLES.MANAGER &&
    (newRole !== ROLES.MANAGER || isTargetDeactivating)
  ) {
    const nonDeactivatedTeamCount = await User.countDocuments({
      managerId: targetUserId,
      accountStatus: { $ne: ACCOUNT_STATUS.DEACTIVATED },
    });
    if (nonDeactivatedTeamCount > 0) {
      throw new ApiError(
        409,
        'HAS_TEAM_MEMBERS',
        'Cannot demote or deactivate a manager with assigned team members'
      );
    }
  }

  // 5. Deactivating a user with an in_progress shift -> 409 OPEN_SHIFT
  if (isTargetDeactivating && targetUser.isActive === true) {
    const openShift = await Attendance.findOne({
      employeeId: targetUserId,
      workingStatus: WORKING_STATUS.IN_PROGRESS,
    });
    if (openShift) {
      throw new ApiError(
        409,
        'OPEN_SHIFT',
        'Cannot deactivate a user with an active in-progress shift'
      );
    }
  }

  // 6. employee -> manager clears managerId
  if (newRole === ROLES.MANAGER || newRole === ROLES.ADMIN) {
    updateData.managerId = null;
    targetUser.managerId = null;
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

