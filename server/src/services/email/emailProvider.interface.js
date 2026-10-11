/**
 * Abstract interface definition for Email Providers.
 * Implementations must satisfy:
 *   send({ to, subject, html, text, replyTo, idempotencyKey })
 *   -> { ok: true, providerMessageId: string }
 *    | { ok: false, error: { code: string, message: string, retryable: boolean, outcomeUnknown?: boolean } }
 *
 *   getStatus(providerMessageId)
 *   -> { ok: true, lastEvent: string | null, createdAt: string | null, to?: string[] | string }
 *    | { ok: false, error: { code: string, message: string, retryable: boolean } }
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
   * @returns {Promise<{ ok: true, providerMessageId: string } | { ok: false, error: { code: string, message: string, retryable: boolean, outcomeUnknown?: boolean } }>}
   */
  async send(_options) {
    throw new Error('send must be implemented by the email provider');
  }

  /**
   * Alias for backward compatibility if needed
   */
  async sendInvitation(options) {
    return this.send(options);
  }

  /**
   * @param {string} _providerMessageId
   * @returns {Promise<{ ok: true, lastEvent: string | null, createdAt: string | null, to?: string[] | string } | { ok: false, error: { code: string, message: string, retryable: boolean } }>}
   */
  async getStatus(_providerMessageId) {
    throw new Error('getStatus must be implemented by the email provider');
  }
}

export default EmailProvider;
