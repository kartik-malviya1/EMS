import { Invitation } from '../models/invitation.model.js';
import { AuditLog } from '../models/auditLog.model.js';
import { AUDIT_ACTIONS } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { env, isEmailConfigured } from '../config/env.js';
import { getEmailProvider, renderTestEmailTemplate } from './email/index.js';
import { logAuditEvent } from './audit.service.js';

export const sendAdminTestEmail = async ({ adminUser, to, req }) => {
  if (!isEmailConfigured()) {
    throw new ApiError(
      503,
      'EMAIL_NOT_CONFIGURED',
      'Email delivery is not configured. Configure RESEND_API_KEY and EMAIL_FROM to send test emails.'
    );
  }

  const normalizedTo = to.toLowerCase().trim();
  const template = renderTestEmailTemplate({
    sentAt: new Date(),
    senderAddress: env.EMAIL_FROM,
  });

  const provider = getEmailProvider();
  const providerResult = await provider.send({
    to: normalizedTo,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });

  if (providerResult.ok) {
    await logAuditEvent({
      actor: adminUser,
      action: AUDIT_ACTIONS.EMAIL_TEST_SENT,
      targetUser: null,
      metadata: {
        recipient: normalizedTo,
        providerMessageId: providerResult.providerMessageId,
      },
      req,
    });

    return {
      email: {
        status: 'accepted',
        providerMessageId: providerResult.providerMessageId,
      },
    };
  } else {
    await logAuditEvent({
      actor: adminUser,
      action: AUDIT_ACTIONS.EMAIL_TEST_SENT,
      targetUser: null,
      metadata: {
        recipient: normalizedTo,
        error: providerResult.error?.code,
      },
      req,
    });

    const statusCode = providerResult.error?.code === 'EMAIL_STATUS_NOT_PERMITTED' ? 403 : 502;
    throw new ApiError(
      statusCode,
      providerResult.error?.code || 'EMAIL_PROVIDER_ERROR',
      providerResult.error?.message || 'Failed to deliver test email'
    );
  }
};

export const getEmailMessageDetails = async ({ providerMessageId }) => {
  if (!providerMessageId) {
    throw new ApiError(400, 'INVALID_MESSAGE_ID', 'Provider message ID is required');
  }

  // Guard: ID must exist as an emailProviderMessageId on an invitation or in an EMAIL_TEST_SENT audit entry
  const [invitationMatch, auditMatch] = await Promise.all([
    Invitation.exists({ emailProviderMessageId: providerMessageId }),
    AuditLog.exists({
      action: AUDIT_ACTIONS.EMAIL_TEST_SENT,
      'metadata.providerMessageId': providerMessageId,
    }),
  ]);

  if (!invitationMatch && !auditMatch) {
    throw new ApiError(404, 'NOT_FOUND', 'Message not found or was not sent by this application');
  }

  const provider = getEmailProvider();
  const result = await provider.getStatus(providerMessageId);

  if (!result.ok) {
    const statusCode = result.error?.code === 'EMAIL_STATUS_NOT_PERMITTED' ? 403 : 502;
    throw new ApiError(
      statusCode,
      result.error?.code || 'EMAIL_PROVIDER_ERROR',
      result.error?.message || 'Failed to retrieve email status from provider'
    );
  }

  return {
    id: providerMessageId,
    lastEvent: result.lastEvent,
    createdAt: result.createdAt,
    to: result.to,
  };
};
