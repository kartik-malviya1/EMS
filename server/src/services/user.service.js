import { User } from '../models/user.model.js';
import { ROLES } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';

export const listUsers = async ({ role, search, isActive, managerId, page = 1, limit = 20 }) => {
  const query = {};

  if (role) {
    query.role = role;
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

export const updateUser = async (adminUser, targetUserId, updateData) => {
  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found');
  }

  const isSelf = adminUser._id.toString() === targetUserId.toString();

  // 1. Admin cannot change own role
  if (isSelf && updateData.role !== undefined && updateData.role !== targetUser.role) {
    throw new ApiError(400, 'CANNOT_CHANGE_OWN_ROLE', 'Admin cannot change own role');
  }

  // 2. Admin cannot deactivate self
  if (isSelf && updateData.isActive === false) {
    throw new ApiError(400, 'CANNOT_DEACTIVATE_SELF', 'Admin cannot deactivate self');
  }

  const newRole = updateData.role !== undefined ? updateData.role : targetUser.role;
  const newIsActive = updateData.isActive !== undefined ? updateData.isActive : targetUser.isActive;

  // 3. Cannot demote/deactivate the last active admin
  if (
    targetUser.role === ROLES.ADMIN &&
    (newRole !== ROLES.ADMIN || newIsActive === false)
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
    (newRole !== ROLES.MANAGER || newIsActive === false)
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

  // 5. Setting role to manager/admin forces managerId = null
  if (newRole === ROLES.MANAGER || newRole === ROLES.ADMIN) {
    updateData.managerId = null;
  }

  // 6. managerId validation for employee
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

  // Apply updates
  if (updateData.name !== undefined) targetUser.name = updateData.name;
  if (updateData.role !== undefined) targetUser.role = updateData.role;
  if (updateData.managerId !== undefined) targetUser.managerId = updateData.managerId;
  if (updateData.isActive !== undefined) targetUser.isActive = updateData.isActive;

  await targetUser.save();

  return User.findById(targetUserId).populate('managerId', 'name email role');
};
