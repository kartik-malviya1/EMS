/**
 * Abstract interface definition for Email Providers.
 * Implementations must satisfy:
 *   sendInvitation({ to, subject, html, text, replyTo, idempotencyKey })
 *   -> { ok: true, providerMessageId: string | null, devOnly?: boolean }
 *    | { ok: false, error: { code: string, message: string, retryable: boolean, outcomeUnknown?: boolean } }
 */
export class EmailProvider {
  /**
   * @param {Object} options
   * @param {string} options.to
   * @param {string} options.subject
   * @param {string} options.html
   * @param {string} options.text
   * @param {string} [options.replyTo]
   * @param {string} [options.idempotencyKey]
   * @returns {Promise<{ ok: true, providerMessageId?: string, devOnly?: boolean } | { ok: false, error: { code: string, message: string, retryable: boolean, outcomeUnknown?: boolean } }>}
   */
  async sendInvitation(_options) {
    throw new Error('sendInvitation must be implemented by the email provider');
  }
}
