import { env } from '../../config/env.js';
import { ResendEmailProvider } from './resend.provider.js';
import { DevelopmentEmailProvider } from './development.provider.js';

export { EmailProvider } from './emailProvider.interface.js';
export { ResendEmailProvider } from './resend.provider.js';
export { DevelopmentEmailProvider } from './development.provider.js';
export { EMAIL_ERROR_CODES, mapResendError } from './errors.js';
export { renderInvitationTemplate, escapeHtml } from './templates/invitation.template.js';

let activeProvider = null;

/**
 * Factory creating provider based on EMAIL_MODE.
 */
export const createEmailProvider = (mode = env.EMAIL_MODE) => {
  if (mode === 'resend') {
    return new ResendEmailProvider();
  }
  return new DevelopmentEmailProvider();
};

/**
 * Get active email provider (singleton with override support).
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
 * Reset injected provider back to default factory.
 */
export const resetEmailProvider = () => {
  activeProvider = null;
};
