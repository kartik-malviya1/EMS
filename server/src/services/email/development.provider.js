import { EmailProvider } from './emailProvider.interface.js';
import { logger } from '../../utils/logger.js';

/**
 * Development provider for local execution.
 * Sends nothing to external networks; returns { ok: true, devOnly: true }.
 */
export class DevelopmentEmailProvider extends EmailProvider {
  async sendInvitation({ to, subject }) {
    logger.info(`[EMAIL:DEV_MODE] Simulated email delivery to ${to} (Subject: "${subject}")`);
    return {
      ok: true,
      devOnly: true,
      providerMessageId: null,
    };
  }
}
