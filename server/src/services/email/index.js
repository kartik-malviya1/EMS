import { ResendEmailProvider } from './resend.provider.js';

export { EmailProvider } from './emailProvider.interface.js';
export { ResendEmailProvider } from './resend.provider.js';
export { EMAIL_ERROR_CODES, mapResendError, mapEmailLastEvent } from './errors.js';
export { renderInvitationTemplate, escapeHtml } from './templates/invitation.template.js';
export { renderTestEmailTemplate } from './templates/test-email.template.js';

let activeProvider = null;

/**
 * Creates Resend email provider instance.
 */
export const createEmailProvider = () => {
  return new ResendEmailProvider();
};

/**
 * Get active email provider (singleton with test override support).
 */
export const getEmailProvider = () => {
  if (!activeProvider) {
    activeProvider = createEmailProvider();
  }
  return activeProvider;
};

/**
 * Inject a custom email provider (used in unit/integration tests).
 */
export const setEmailProvider = (provider) => {
  activeProvider = provider;
};

/**
 * Reset injected provider back to default singleton.
 */
export const resetEmailProvider = () => {
  activeProvider = null;
};
