import crypto from 'crypto';
import { Invitation } from '../models/invitation.model.js';
import { User } from '../models/user.model.js';
import {
  ROLES,
  ACCOUNT_STATUS,
  INVITATION_STATUS,
  AUDIT_ACTIONS,
  EMAIL_DELIVERY_STATUS,
} from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { env, isEmailConfigured } from '../config/env.js';
import {
  getEmailProvider,
  renderInvitationTemplate,
} from './email/index.js';
import { logAuditEvent } from './audit.service.js';
import { logger } from '../utils/logger.js';

export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Builds an invitation URL using APP_BASE_URL.
 * Normalizes protocol/host and avoids string concatenation.
 */
export const buildInvitationUrl = (rawToken) => {
  const base = new URL(env.APP_BASE_URL || 'http://localhost:5173');
  const url = new URL('/accept-invitation', base);
  url.searchParams.set('token', rawToken);
  return url.toString();
};

/**
 * Converts Mongoose invitation document to safe public/admin representation.
 * Never includes raw tokens or token hashes.
 */
export const toSafeInvitation = (inv) => ({
  id: inv._id ? inv._id.toString() : inv.id,
  userId: inv.userId,
  email: inv.email,
  name: inv.name,
  role: inv.role,
  employeeId: inv.employeeId,
  department: inv.department,
  designation: inv.designation,
  status: inv.status,
  emailDeliveryStatus: inv.emailDeliveryStatus,
  emailProviderMessageId: inv.emailProviderMessageId || null,
  emailLastEvent: inv.emailLastEvent || null,
  emailLastEventAt: inv.emailLastEventAt || null,
  emailAttempt: inv.emailAttempt || 0,
  emailLastError: inv.emailLastError
    ? {
        code: inv.emailLastError.code,
        message: inv.emailLastError.message,
        at: inv.emailLastError.at,
        outcomeUnknown: Boolean(inv.emailLastError.outcomeUnknown),
      }
    : null,
  resendCount: inv.resendCount || 0,
  lastSentAt: inv.lastSentAt,
  expiresAt: inv.expiresAt,
  createdAt: inv.createdAt,
  updatedAt: inv.updatedAt,
});

/**
 * Atomic send claim using sendingAt lease (30 seconds timeout).
 */
export const claimSend = async (invitationId) => {
  const now = new Date();
  const staleThreshold = new Date(Date.now() - 30 * 1000);
  return Invitation.findOneAndUpdate(
    {
      _id: invitationId,
      $or: [{ sendingAt: null }, { sendingAt: { $lt: staleThreshold } }],
    },
    { $set: { sendingAt: now } },
    { returnDocument: 'after' }
  );
};

export const clearSendClaim = async (invitationId) => {
  try {
    await Invitation.updateOne({ _id: invitationId }, { $set: { sendingAt: null } });
  } catch (err) {
    logger.error('Failed to clear sendingAt claim:', err.message);
  }
};

/**
 * Admin creates an invitation and provisions an unactivated employee/manager account.
 */
export const createInvitation = async ({
  adminUser,
  data,
  req,
  emailProvider = getEmailProvider(),
}) => {
  // Reject immediately if email provider is not configured BEFORE creating/modifying records
  if (!isEmailConfigured()) {
    throw new ApiError(
      503,
      'EMAIL_NOT_CONFIGURED',
      'Email delivery is not configured. Configure RESEND_API_KEY and EMAIL_FROM to send invitations.'
    );
  }

  const normalizedEmail = data.email.toLowerCase().trim();

  // Role restriction: Invitations can only be for employee or manager
  if (data.role !== ROLES.EMPLOYEE && data.role !== ROLES.MANAGER) {
    throw new ApiError(
      400,
      'INVALID_ROLE',
      'Invitations can only be issued for Employee or Manager roles'
    );
  }

  // Check if active user already exists
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser && existingUser.accountStatus === ACCOUNT_STATUS.ACTIVE) {
    throw new ApiError(
      409,
      'USER_ALREADY_EXISTS',
      'An active user account with this email address already exists'
    );
  }

  // Check if a pending unexpired invitation already exists for this email
  const existingPendingInvitation = await Invitation.findOne({
    email: normalizedEmail,
    status: INVITATION_STATUS.PENDING,
    expiresAt: { $gt: new Date() },
  });

  if (existingPendingInvitation) {
    throw new ApiError(
      409,
      'INVITATION_ALREADY_PENDING',
      'A pending invitation already exists for this email address. Please resend or revoke it instead.'
    );
  }

  // Validate managerId if role is employee
  let assignedManagerId = null;
  if (data.role === ROLES.EMPLOYEE && data.managerId) {
    const manager = await User.findOne({
      _id: data.managerId,
      role: ROLES.MANAGER,
      isActive: true,
    });
    if (!manager) {
      throw new ApiError(
        400,
        'INVALID_MANAGER',
        'The specified reporting manager does not exist or is not an active manager'
      );
    }
    assignedManagerId = manager._id;
  }

  // Validate unique employeeId if supplied
  if (data.employeeId && data.employeeId.trim()) {
    const existingEmpId = await User.findOne({
      employeeId: data.employeeId.trim(),
      ...(existingUser ? { _id: { $ne: existingUser._id } } : {}),
    });
    if (existingEmpId) {
      throw new ApiError(409, 'EMPLOYEE_ID_EXISTS', 'An employee with this Employee ID already exists');
    }
  }

  // Provision or reuse invited user record
  let user = existingUser;
  if (!user) {
    user = await User.create({
      name: data.name.trim(),
      email: normalizedEmail,
      role: data.role,
      employeeId: data.employeeId?.trim() || undefined,
      department: data.department?.trim() || '',
      designation: data.designation?.trim() || '',
      managerId: assignedManagerId,
      accountStatus: ACCOUNT_STATUS.INVITED,
      isActive: false,
    });
  } else {
    user.name = data.name.trim();
    user.role = data.role;
    user.employeeId = data.employeeId?.trim() || user.employeeId;
    user.department = data.department?.trim() || user.department;
    user.designation = data.designation?.trim() || user.designation;
    user.managerId = assignedManagerId;
    user.accountStatus = ACCOUNT_STATUS.INVITED;
    user.isActive = false;
    await user.save();
  }

  // Generate cryptographically secure token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  const expiryHours = Number(env.INVITATION_EXPIRY_HOURS) || 72;
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

  // Invalidate any previously expired or old pending invitations for this email
  await Invitation.updateMany(
    { email: normalizedEmail, status: INVITATION_STATUS.PENDING },
    { status: INVITATION_STATUS.REVOKED, revokedAt: new Date() }
  );

  const invitation = await Invitation.create({
    userId: user._id,
    email: normalizedEmail,
    name: data.name.trim(),
    role: data.role,
    employeeId: data.employeeId?.trim() || '',
    department: data.department?.trim() || '',
    designation: data.designation?.trim() || '',
    invitedBy: adminUser._id,
    tokenHash,
    status: INVITATION_STATUS.PENDING,
    expiresAt,
    lastSentAt: new Date(),
    resendCount: 0,
    emailDeliveryStatus: EMAIL_DELIVERY_STATUS.PENDING,
    emailAttempt: 0,
  });

  const invitationUrl = buildInvitationUrl(rawToken);

  // Log creation audit
  await logAuditEvent({
    actor: adminUser,
    action: AUDIT_ACTIONS.INVITATION_CREATED,
    targetUser: user,
    invitationId: invitation._id,
    metadata: { role: data.role, expiresAt },
    req,
  });

  // Claim send concurrency
  const claimed = await claimSend(invitation._id);
  if (!claimed) {
    throw new ApiError(409, 'SEND_IN_PROGRESS', 'An invitation email send is currently in progress.');
  }

  let providerResult;
  try {
    const template = renderInvitationTemplate({
      name: data.name.trim(),
      role: data.role,
      adminName: adminUser.name,
      invitationUrl,
      expiresAt,
    });

    const attemptNumber = 1;
    const idempotencyKey = `invitation:${invitation._id}:attempt:${attemptNumber}`;

    providerResult = await emailProvider.send({
      to: normalizedEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      replyTo: env.EMAIL_REPLY_TO || undefined,
      idempotencyKey,
    });

    if (providerResult.ok) {
      invitation.emailDeliveryStatus = EMAIL_DELIVERY_STATUS.ACCEPTED;
      invitation.emailProviderMessageId = providerResult.providerMessageId || null;
      invitation.emailAttempt = attemptNumber;
      invitation.lastSentAt = new Date();
      invitation.emailLastError = null;
      invitation.emailLastEvent = null;
      invitation.emailLastEventAt = null;
      await invitation.save();

      await logAuditEvent({
        actor: adminUser,
        action: AUDIT_ACTIONS.INVITATION_EMAIL_ACCEPTED,
        targetUser: user,
        invitationId: invitation._id,
        metadata: {
          provider: env.EMAIL_PROVIDER,
          messageId: providerResult.providerMessageId || null,
        },
        req,
      });
    } else {
      invitation.emailDeliveryStatus = EMAIL_DELIVERY_STATUS.FAILED;
      invitation.emailAttempt = attemptNumber;
      invitation.emailLastError = {
        code: providerResult.error?.code,
        message: providerResult.error?.message,
        at: new Date(),
        outcomeUnknown: Boolean(providerResult.error?.outcomeUnknown),
      };
      await invitation.save();

      await logAuditEvent({
        actor: adminUser,
        action: AUDIT_ACTIONS.INVITATION_EMAIL_FAILED,
        targetUser: user,
        invitationId: invitation._id,
        metadata: {
          error: providerResult.error?.code,
        },
        req,
      });
    }
  } finally {
    await clearSendClaim(invitation._id);
  }

  return {
    invitation: toSafeInvitation(invitation),
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
    },
    email: {
      status: invitation.emailDeliveryStatus,
      providerMessageId: invitation.emailProviderMessageId || undefined,
      error: invitation.emailLastError
        ? {
            code: invitation.emailLastError.code,
            message: invitation.emailLastError.message,
          }
        : undefined,
    },
  };
};

/**
 * List invitations with filters, search, and pagination.
 */
export const listInvitations = async ({ status, role, search, page = 1, limit = 20 }) => {
  const query = {};

  if (status) {
    query.status = status;
  }

  if (role) {
    query.role = role;
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [{ name: searchRegex }, { email: searchRegex }, { employeeId: searchRegex }];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [invitations, total] = await Promise.all([
    Invitation.find(query)
      .populate('invitedBy', 'name email role')
      .populate('userId', 'name email role accountStatus department designation employeeId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Invitation.countDocuments(query),
  ]);

  return {
    invitations: invitations.map(toSafeInvitation),
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

/**
 * Retrieve a single invitation by ID.
 */
export const getInvitationById = async (id) => {
  const invitation = await Invitation.findById(id)
    .populate('invitedBy', 'name email role')
    .populate('userId', 'name email role accountStatus department designation employeeId');

  if (!invitation) {
    throw new ApiError(404, 'NOT_FOUND', 'Invitation not found');
  }

  return toSafeInvitation(invitation);
};

/**
 * Resend an invitation:
 * - Preconditions: pending or expired; not revoked/accepted.
 * - Enforces max resends (409) and cooldown (429 with retryAfterSeconds).
 * - Safe concurrency lease on sendingAt.
 * - Resend ordering: generates new token, sends email FIRST in resend mode;
 *   atomically updates tokenHash only upon provider acceptance.
 *   If send fails: old token is preserved, status failed recorded, returns 502.
 */
export const resendInvitation = async ({
  adminUser,
  invitationId,
  req,
  emailProvider = getEmailProvider(),
}) => {
  if (!isEmailConfigured()) {
    throw new ApiError(
      503,
      'EMAIL_NOT_CONFIGURED',
      'Email delivery is not configured. Configure RESEND_API_KEY and EMAIL_FROM to send invitations.'
    );
  }

  const oldInvitation = await Invitation.findById(invitationId);
  if (!oldInvitation) {
    throw new ApiError(404, 'NOT_FOUND', 'Invitation not found');
  }

  if (oldInvitation.status === INVITATION_STATUS.ACCEPTED) {
    throw new ApiError(400, 'CANNOT_RESEND_ACCEPTED', 'Accepted invitations cannot be resent');
  }

  if (oldInvitation.status === INVITATION_STATUS.REVOKED) {
    throw new ApiError(400, 'CANNOT_RESEND_REVOKED', 'Revoked invitations cannot be resent');
  }

  const maxResends = Number(env.INVITATION_MAX_RESENDS) || 10;
  if ((oldInvitation.resendCount || 0) >= maxResends) {
    throw new ApiError(
      409,
      'RESEND_LIMIT_REACHED',
      `Maximum invitation resend limit (${maxResends}) reached for this recipient.`
    );
  }

  const cooldownSeconds = Number(env.INVITATION_RESEND_COOLDOWN_SECONDS) || 60;
  const lastAttemptTime =
    oldInvitation.emailLastError?.at ||
    oldInvitation.lastSentAt ||
    oldInvitation.createdAt;

  if (lastAttemptTime) {
    const elapsedSeconds = (Date.now() - new Date(lastAttemptTime).getTime()) / 1000;
    if (elapsedSeconds < cooldownSeconds) {
      const retryAfterSeconds = Math.max(1, Math.ceil(cooldownSeconds - elapsedSeconds));
      const cooldownError = new ApiError(
        429,
        'RESEND_COOLDOWN',
        `Please wait ${retryAfterSeconds}s before resending another invitation.`,
        { retryAfterSeconds }
      );
      throw cooldownError;
    }
  }

  // Atomic claim
  const claimed = await claimSend(oldInvitation._id);
  if (!claimed) {
    throw new ApiError(409, 'SEND_IN_PROGRESS', 'An invitation email send is currently in progress.');
  }

  try {
    // Generate fresh token and new expiry
    const rawToken = crypto.randomBytes(32).toString('hex');
    const newTokenHash = hashToken(rawToken);
    const expiryHours = Number(env.INVITATION_EXPIRY_HOURS) || 72;
    const newExpiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    const invitationUrl = buildInvitationUrl(rawToken);

    // Idempotency: n increments EXCEPT when previous attempt ended in EMAIL_TIMEOUT
    const prevWasTimeout = Boolean(oldInvitation.emailLastError?.outcomeUnknown);
    const attemptNumber = prevWasTimeout
      ? (oldInvitation.emailAttempt || 1)
      : (oldInvitation.emailAttempt || 0) + 1;
    const idempotencyKey = `invitation:${oldInvitation._id}:attempt:${attemptNumber}`;

    // Send invitation via provider
    const template = renderInvitationTemplate({
      name: oldInvitation.name,
      role: oldInvitation.role,
      adminName: adminUser.name,
      invitationUrl,
      expiresAt: newExpiresAt,
    });

    const providerResult = await emailProvider.send({
      to: oldInvitation.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      replyTo: env.EMAIL_REPLY_TO || undefined,
      idempotencyKey,
    });

    if (providerResult.ok) {
      // ONLY on provider acceptance: atomically update tokenHash and lifecycle
      const updated = await Invitation.findOneAndUpdate(
        { _id: oldInvitation._id },
        {
          $set: {
            tokenHash: newTokenHash,
            expiresAt: newExpiresAt,
            status: INVITATION_STATUS.PENDING,
            emailDeliveryStatus: EMAIL_DELIVERY_STATUS.ACCEPTED,
            emailProviderMessageId: providerResult.providerMessageId || null,
            emailAttempt: attemptNumber,
            lastSentAt: new Date(),
            emailLastError: null,
            emailLastEvent: null,
            emailLastEventAt: null,
          },
          $inc: { resendCount: 1 },
        },
        { returnDocument: 'after' }
      );

      if (!updated) {
        logger.error('Failed to update invitation state after provider acceptance');
        throw new ApiError(
          500,
          'INVITATION_STATE_UPDATE_FAILED',
          'Failed to update invitation state after successful email send.'
        );
      }

      await logAuditEvent({
        actor: adminUser,
        action: AUDIT_ACTIONS.INVITATION_RESENT,
        targetUser: { _id: oldInvitation.userId, email: oldInvitation.email },
        invitationId: oldInvitation._id,
        metadata: { resendCount: updated.resendCount, expiresAt: newExpiresAt },
        req,
      });

      await logAuditEvent({
        actor: adminUser,
        action: AUDIT_ACTIONS.INVITATION_EMAIL_ACCEPTED,
        targetUser: { _id: oldInvitation.userId, email: oldInvitation.email },
        invitationId: oldInvitation._id,
        metadata: {
          provider: env.EMAIL_PROVIDER,
          messageId: providerResult.providerMessageId || null,
        },
        req,
      });

      return {
        invitation: toSafeInvitation(updated),
        email: {
          status: EMAIL_DELIVERY_STATUS.ACCEPTED,
          providerMessageId: providerResult.providerMessageId,
        },
      };
    } else {
      // Send failed: Old token is UNTOUCHED! Status failed saved.
      oldInvitation.emailDeliveryStatus = EMAIL_DELIVERY_STATUS.FAILED;
      oldInvitation.emailAttempt = attemptNumber;
      oldInvitation.emailLastError = {
        code: providerResult.error?.code,
        message: providerResult.error?.message,
        at: new Date(),
        outcomeUnknown: Boolean(providerResult.error?.outcomeUnknown),
      };
      await oldInvitation.save();

      await logAuditEvent({
        actor: adminUser,
        action: AUDIT_ACTIONS.INVITATION_EMAIL_FAILED,
        targetUser: { _id: oldInvitation.userId, email: oldInvitation.email },
        invitationId: oldInvitation._id,
        metadata: {
          error: providerResult.error?.code,
        },
        req,
      });

      // 502 with standard error envelope
      throw new ApiError(
        502,
        providerResult.error?.code || 'EMAIL_PROVIDER_ERROR',
        providerResult.error?.message || 'Email delivery failed'
      );
    }
  } finally {
    await clearSendClaim(oldInvitation._id);
  }
};

/**
 * Check and refresh delivery status for an invitation.
 */
export const checkInvitationDelivery = async ({ invitationId }) => {
  const invitation = await Invitation.findById(invitationId);
  if (!invitation) {
    throw new ApiError(404, 'NOT_FOUND', 'Invitation not found');
  }

  if (!invitation.emailProviderMessageId) {
    throw new ApiError(
      409,
      'NO_PROVIDER_MESSAGE_ID',
      'This invitation has no provider message ID to check delivery status.'
    );
  }

  const provider = getEmailProvider();
  const statusResult = await provider.getStatus(invitation.emailProviderMessageId);

  if (!statusResult.ok) {
    const statusCode = statusResult.error?.code === 'EMAIL_STATUS_NOT_PERMITTED' ? 403 : 502;
    throw new ApiError(
      statusCode,
      statusResult.error?.code || 'EMAIL_PROVIDER_ERROR',
      statusResult.error?.message || 'Failed to retrieve delivery status from provider'
    );
  }

  invitation.emailLastEvent = statusResult.lastEvent;
  invitation.emailLastEventAt = new Date();
  await invitation.save();

  return {
    id: invitation._id.toString(),
    status: invitation.emailDeliveryStatus,
    providerMessageId: invitation.emailProviderMessageId,
    lastEvent: invitation.emailLastEvent,
    lastEventAt: invitation.emailLastEventAt,
  };
};

/**
 * Revoke an active pending invitation.
 */
export const revokeInvitation = async ({ adminUser, invitationId, req }) => {
  const invitation = await Invitation.findById(invitationId);
  if (!invitation) {
    throw new ApiError(404, 'NOT_FOUND', 'Invitation not found');
  }

  if (invitation.status === INVITATION_STATUS.ACCEPTED) {
    throw new ApiError(400, 'CANNOT_REVOKE_ACCEPTED', 'Accepted invitations cannot be revoked');
  }

  if (invitation.status === INVITATION_STATUS.REVOKED) {
    return toSafeInvitation(invitation);
  }

  const updatedInvitation = await Invitation.findOneAndUpdate(
    {
      _id: invitationId,
      status: { $ne: INVITATION_STATUS.ACCEPTED },
    },
    {
      $set: {
        status: INVITATION_STATUS.REVOKED,
        revokedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  if (!updatedInvitation) {
    throw new ApiError(400, 'CANNOT_REVOKE_ACCEPTED', 'Accepted invitations cannot be revoked');
  }

  await logAuditEvent({
    actor: adminUser,
    action: AUDIT_ACTIONS.INVITATION_REVOKED,
    targetUser: { _id: updatedInvitation.userId, email: updatedInvitation.email },
    invitationId: updatedInvitation._id,
    metadata: {},
    req,
  });

  return toSafeInvitation(updatedInvitation);
};

/**
 * Validate an invitation token submitted by an invited employee.
 */
export const validateInvitationToken = async (rawToken) => {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new ApiError(400, 'INVALID_TOKEN', 'A valid invitation token is required');
  }

  const tokenHash = hashToken(rawToken);

  const invitation = await Invitation.findOne({ tokenHash });
  if (!invitation) {
    throw new ApiError(404, 'INVALID_TOKEN', 'This invitation link is invalid or does not exist');
  }

  if (invitation.status === INVITATION_STATUS.REVOKED) {
    throw new ApiError(410, 'INVITATION_REVOKED', 'This invitation has been revoked by an administrator');
  }

  if (invitation.status === INVITATION_STATUS.ACCEPTED) {
    throw new ApiError(
      409,
      'INVITATION_ALREADY_ACCEPTED',
      'This invitation has already been accepted. Please sign in with your credentials.'
    );
  }

  // Check expiration
  if (invitation.status === INVITATION_STATUS.EXPIRED || new Date(invitation.expiresAt) < new Date()) {
    if (invitation.status === INVITATION_STATUS.PENDING) {
      invitation.status = INVITATION_STATUS.EXPIRED;
      await invitation.save();
    }
    throw new ApiError(
      410,
      'INVITATION_EXPIRED',
      'This invitation link has expired. Please contact your administrator for a new invitation.'
    );
  }

  // Verify associated account eligibility
  const user = await User.findById(invitation.userId);
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'Associated employee account was not found');
  }

  if (user.accountStatus === ACCOUNT_STATUS.ACTIVE) {
    throw new ApiError(409, 'ACCOUNT_ALREADY_ACTIVE', 'This account has already been activated. Please sign in.');
  }

  if (user.accountStatus === ACCOUNT_STATUS.SUSPENDED || user.accountStatus === ACCOUNT_STATUS.DEACTIVATED) {
    throw new ApiError(
      403,
      'ACCOUNT_NOT_ELIGIBLE',
      'This account is currently suspended or deactivated. Please contact an administrator.'
    );
  }

  return {
    valid: true,
    email: invitation.email,
    name: invitation.name,
    role: invitation.role,
    department: invitation.department,
    designation: invitation.designation,
    expiresAt: invitation.expiresAt,
  };
};

/**
 * Accept invitation and activate account with employee-established password.
 */
export const acceptInvitation = async ({ rawToken, password, req }) => {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new ApiError(400, 'INVALID_TOKEN', 'A valid invitation token is required');
  }

  const tokenHash = hashToken(rawToken);

  const invitation = await Invitation.findOne({ tokenHash });
  if (!invitation) {
    throw new ApiError(404, 'INVALID_TOKEN', 'This invitation link is invalid or does not exist');
  }

  if (invitation.status === INVITATION_STATUS.REVOKED) {
    throw new ApiError(410, 'INVITATION_REVOKED', 'This invitation has been revoked by an administrator');
  }

  if (invitation.status === INVITATION_STATUS.ACCEPTED) {
    throw new ApiError(
      409,
      'INVITATION_ALREADY_ACCEPTED',
      'This invitation has already been accepted. Please sign in.'
    );
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    invitation.status = INVITATION_STATUS.EXPIRED;
    await invitation.save();
    throw new ApiError(
      410,
      'INVITATION_EXPIRED',
      'This invitation link has expired. Please contact your administrator.'
    );
  }

  const user = await User.findById(invitation.userId);
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'Associated employee account was not found');
  }

  if (user.accountStatus === ACCOUNT_STATUS.SUSPENDED || user.accountStatus === ACCOUNT_STATUS.DEACTIVATED) {
    throw new ApiError(
      403,
      'ACCOUNT_NOT_ELIGIBLE',
      'This account is suspended or deactivated and cannot be activated'
    );
  }

  // Atomic state transition: ensure status is still PENDING at time of acceptance
  const updatedInvitation = await Invitation.findOneAndUpdate(
    {
      _id: invitation._id,
      status: INVITATION_STATUS.PENDING,
    },
    {
      $set: {
        status: INVITATION_STATUS.ACCEPTED,
        acceptedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  if (!updatedInvitation) {
    const current = await Invitation.findById(invitation._id);
    if (current?.status === INVITATION_STATUS.REVOKED) {
      throw new ApiError(410, 'INVITATION_REVOKED', 'This invitation has been revoked by an administrator');
    }
    if (current?.status === INVITATION_STATUS.ACCEPTED) {
      throw new ApiError(409, 'INVITATION_ALREADY_ACCEPTED', 'This invitation has already been accepted. Please sign in.');
    }
    throw new ApiError(410, 'INVITATION_EXPIRED', 'This invitation link has expired. Please contact your administrator.');
  }

  const passwordHash = await User.hashPassword(password);

  user.passwordHash = passwordHash;
  user.accountStatus = ACCOUNT_STATUS.ACTIVE;
  user.isActive = true;
  await user.save();

  await logAuditEvent({
    actor: { _id: user._id, email: user.email, role: user.role },
    action: AUDIT_ACTIONS.INVITATION_ACCEPTED,
    targetUser: user,
    invitationId: updatedInvitation._id,
    metadata: { role: user.role },
    req,
  });

  return {
    success: true,
    message: 'Account activated successfully. You can now log in with your credentials.',
    email: user.email,
  };
};

/**
 * Self-service: Processes "Request my invitation link" in the background.
 * - Always run asynchronously via setImmediate so response time does not leak existence.
 * - Finds latest invitation with status pending or expired for an account with status 'invited'.
 * - Respects cooldown and max-resend limits.
 * - Rotates token only upon provider acceptance.
 * - Logs INVITATION_LINK_REQUESTED security audit event with metadata without tokens or links.
 */
export const processSelfServiceInvitationRequest = async ({
  email,
  req,
  emailProvider = getEmailProvider(),
}) => {
  const normalizedEmail = email ? String(email).toLowerCase().trim() : '';
  if (!normalizedEmail) return;

  try {
    const invitation = await Invitation.findOne({
      email: normalizedEmail,
      status: { $in: [INVITATION_STATUS.PENDING, INVITATION_STATUS.EXPIRED] },
    }).sort({ createdAt: -1 });

    if (!invitation) {
      await logAuditEvent({
        actor: null,
        action: AUDIT_ACTIONS.INVITATION_LINK_REQUESTED,
        targetUser: null,
        metadata: { found: false, outcome: 'NO_INVITATION' },
        req,
      });
      return;
    }

    const user = await User.findById(invitation.userId);
    if (!user || user.accountStatus !== ACCOUNT_STATUS.INVITED) {
      await logAuditEvent({
        actor: null,
        action: AUDIT_ACTIONS.INVITATION_LINK_REQUESTED,
        targetUser: user ? { _id: user._id, email: user.email } : null,
        invitationId: invitation._id,
        metadata: { found: false, outcome: 'USER_NOT_INVITED' },
        req,
      });
      return;
    }

    const maxResends = Number(env.INVITATION_MAX_RESENDS) || 10;
    if ((invitation.resendCount || 0) >= maxResends) {
      await logAuditEvent({
        actor: null,
        action: AUDIT_ACTIONS.INVITATION_LINK_REQUESTED,
        targetUser: { _id: user._id, email: user.email },
        invitationId: invitation._id,
        metadata: { found: true, outcome: 'RESEND_LIMIT_REACHED' },
        req,
      });
      return;
    }

    const cooldownSeconds = Number(env.INVITATION_RESEND_COOLDOWN_SECONDS) || 60;
    const lastAttemptTime =
      invitation.emailLastError?.at ||
      invitation.lastSentAt ||
      invitation.createdAt;
    if (lastAttemptTime) {
      const elapsedSeconds = (Date.now() - new Date(lastAttemptTime).getTime()) / 1000;
      if (elapsedSeconds < cooldownSeconds) {
        await logAuditEvent({
          actor: null,
          action: AUDIT_ACTIONS.INVITATION_LINK_REQUESTED,
          targetUser: { _id: user._id, email: user.email },
          invitationId: invitation._id,
          metadata: { found: true, outcome: 'COOLDOWN_ACTIVE' },
          req,
        });
        return;
      }
    }

    const claimed = await claimSend(invitation._id);
    if (!claimed) {
      await logAuditEvent({
        actor: null,
        action: AUDIT_ACTIONS.INVITATION_LINK_REQUESTED,
        targetUser: { _id: user._id, email: user.email },
        invitationId: invitation._id,
        metadata: { found: true, outcome: 'SEND_IN_PROGRESS' },
        req,
      });
      return;
    }

    try {
      const adminUser = await User.findById(invitation.invitedBy);
      const adminName = adminUser?.name || 'System Administrator';

      const rawToken = crypto.randomBytes(32).toString('hex');
      const newTokenHash = hashToken(rawToken);
      const expiryHours = Number(env.INVITATION_EXPIRY_HOURS) || 72;
      const newExpiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
      const invitationUrl = buildInvitationUrl(rawToken);

      const prevWasTimeout = Boolean(invitation.emailLastError?.outcomeUnknown);
      const attemptNumber = prevWasTimeout
        ? (invitation.emailAttempt || 1)
        : (invitation.emailAttempt || 0) + 1;
      const idempotencyKey = `invitation:${invitation._id}:attempt:${attemptNumber}`;

      const template = renderInvitationTemplate({
        name: invitation.name,
        role: invitation.role,
        adminName,
        invitationUrl,
        expiresAt: newExpiresAt,
      });

      const providerResult = await emailProvider.send({
        to: invitation.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        replyTo: env.EMAIL_REPLY_TO || undefined,
        idempotencyKey,
      });

      if (providerResult.ok) {
        await Invitation.updateOne(
          { _id: invitation._id },
          {
            $set: {
              tokenHash: newTokenHash,
              expiresAt: newExpiresAt,
              status: INVITATION_STATUS.PENDING,
              emailDeliveryStatus: EMAIL_DELIVERY_STATUS.ACCEPTED,
              emailProviderMessageId: providerResult.providerMessageId || null,
              emailAttempt: attemptNumber,
              lastSentAt: new Date(),
              emailLastError: null,
              emailLastEvent: null,
              emailLastEventAt: null,
            },
            $inc: { resendCount: 1 },
          }
        );

        await logAuditEvent({
          actor: null,
          action: AUDIT_ACTIONS.INVITATION_LINK_REQUESTED,
          targetUser: { _id: user._id, email: user.email },
          invitationId: invitation._id,
          metadata: {
            found: true,
            outcome: 'SENT',
            providerMessageId: providerResult.providerMessageId || null,
          },
          req,
        });
      } else {
        invitation.emailDeliveryStatus = EMAIL_DELIVERY_STATUS.FAILED;
        invitation.emailAttempt = attemptNumber;
        invitation.emailLastError = {
          code: providerResult.error?.code,
          message: providerResult.error?.message,
          at: new Date(),
          outcomeUnknown: Boolean(providerResult.error?.outcomeUnknown),
        };
        await invitation.save();

        await logAuditEvent({
          actor: null,
          action: AUDIT_ACTIONS.INVITATION_LINK_REQUESTED,
          targetUser: { _id: user._id, email: user.email },
          invitationId: invitation._id,
          metadata: {
            found: true,
            outcome: providerResult.error?.code || 'EMAIL_FAILED',
          },
          req,
        });
      }
    } finally {
      await clearSendClaim(invitation._id);
    }
  } catch (err) {
    logger.error('Error during self-service invitation link processing:', err.message);
  }
};
