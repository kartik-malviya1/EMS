import { AuditLog } from '../models/auditLog.model.js';
import { logger } from '../utils/logger.js';

export const logAuditEvent = async ({
  actor = null,
  action,
  targetUser = null,
  invitationId = null,
  metadata = {},
  req = null,
}) => {
  try {
    const actorId = actor?._id || actor?.id || null;
    const actorEmail = actor?.email || '';
    const actorRole = actor?.role || '';

    const targetUserId = targetUser?._id || targetUser?.id || null;
    const targetUserEmail = targetUser?.email || '';

    const ipAddress = req?.ip || req?.socket?.remoteAddress || '';
    const userAgent = req?.headers?.['user-agent'] || '';

    // Sanitize metadata to never include sensitive tokens, secrets, or passwords
    const sanitizedMetadata = { ...metadata };
    delete sanitizedMetadata.password;
    delete sanitizedMetadata.passwordHash;
    delete sanitizedMetadata.token;
    delete sanitizedMetadata.rawToken;
    delete sanitizedMetadata.apiKey;

    await AuditLog.create({
      actorId,
      actorEmail,
      actorRole,
      action,
      targetUserId,
      targetUserEmail,
      invitationId,
      metadata: sanitizedMetadata,
      ipAddress,
      userAgent,
    });
  } catch (err) {
    logger.error('Failed to record audit log entry:', err);
  }
};
