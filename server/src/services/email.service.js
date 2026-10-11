import {
  getEmailProvider,
  renderInvitationTemplate,
} from './email/index.js';

/**
 * Backward compatible helper delegating to the modular email service.
 */
export const sendInvitationEmail = async ({
  to,
  name,
  role,
  adminName,
  invitationUrl,
  expiresAt,
  idempotencyKey,
  replyTo,
}) => {
  const provider = getEmailProvider();
  const template = renderInvitationTemplate({
    name,
    role,
    adminName,
    invitationUrl,
    expiresAt,
  });

  return provider.sendInvitation({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
    replyTo,
    idempotencyKey,
  });
};
