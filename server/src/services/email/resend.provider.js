import { Resend } from 'resend';
import { EmailProvider } from './emailProvider.interface.js';
import { EMAIL_ERROR_CODES, mapResendError } from './errors.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

/**
 * Timeout wrapper using Promise.race.
 */
const withTimeout = (promise, ms) => {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error('Email provider request timed out');
      err.code = 'EMAIL_TIMEOUT';
      reject(err);
    }, ms);
  });

  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    timeoutPromise,
  ]);
};

/**
 * Resend email provider implementing the EmailProvider interface.
 */
export class ResendEmailProvider extends EmailProvider {
  /**
   * @param {Object} [options]
   * @param {string} [options.apiKey]
   * @param {string} [options.defaultFrom]
   * @param {number} [options.timeoutMs]
   * @param {Object} [options.client] Injected client for unit testing
   */
  constructor(options = {}) {
    super();
    this.apiKey = options.apiKey !== undefined ? options.apiKey : env.RESEND_API_KEY;
    this.defaultFrom = options.defaultFrom || env.EMAIL_FROM || 'AMS Portal <onboarding@resend.dev>';
    this.timeoutMs = options.timeoutMs || env.EMAIL_SEND_TIMEOUT_MS || 10000;

    if (options.client) {
      this.client = options.client;
    } else if (
      this.apiKey &&
      typeof this.apiKey === 'string' &&
      this.apiKey.startsWith('re_') &&
      this.apiKey !== 're_xxxxxxxxx'
    ) {
      this.client = new Resend(this.apiKey);
    } else {
      this.client = null;
    }
  }

  /**
   * Send an email through Resend.
   */
  async send({ to, subject, html, text, replyTo, idempotencyKey }) {
    if (!this.client) {
      return {
        ok: false,
        error: {
          code: EMAIL_ERROR_CODES.EMAIL_NOT_CONFIGURED,
          message:
            'Resend API key is not configured or is a placeholder. A valid RESEND_API_KEY is required to send emails.',
          retryable: false,
          outcomeUnknown: false,
        },
      };
    }

    try {
      const payload = {
        from: this.defaultFrom,
        to,
        subject,
        html,
        text,
      };

      if (replyTo) {
        payload.reply_to = replyTo;
      }

      const requestOptions = {};
      if (idempotencyKey) {
        requestOptions.idempotencyKey = idempotencyKey;
        requestOptions.headers = { 'Idempotency-Key': idempotencyKey };
      }

      const sendPromise = this.client.emails.send(payload, requestOptions);
      const result = await withTimeout(sendPromise, this.timeoutMs);

      // Resend Node SDK returns { data, error } instead of throwing
      if (!result || result.error || !result.data?.id) {
        const mapped = mapResendError(result?.error, result?.error?.statusCode);
        logger.warn(`[EMAIL:RESEND_ERROR] Code: ${mapped.code}, Message: ${mapped.message}`);
        return {
          ok: false,
          error: mapped,
        };
      }

      logger.info(`[EMAIL:RESEND_ACCEPTED] Provider accepted email for ${to}. ID: ${result.data.id}`);
      return {
        ok: true,
        providerMessageId: result.data.id,
      };
    } catch (err) {
      if (err.code === 'EMAIL_TIMEOUT') {
        const mapped = mapResendError(err);
        logger.warn(`[EMAIL:RESEND_TIMEOUT] Timeout reached after ${this.timeoutMs}ms.`);
        return {
          ok: false,
          error: mapped,
        };
      }

      const mapped = mapResendError(err);
      logger.error(`[EMAIL:RESEND_EXCEPTION] Exception thrown: ${err.message}`);
      return {
        ok: false,
        error: mapped,
      };
    }
  }

  /**
   * Retrieve email delivery status from Resend.
   */
  async getStatus(providerMessageId) {
    if (!this.client) {
      return {
        ok: false,
        error: {
          code: EMAIL_ERROR_CODES.EMAIL_NOT_CONFIGURED,
          message:
            'Resend API key is not configured or is a placeholder. A valid RESEND_API_KEY is required to retrieve status.',
          retryable: false,
        },
      };
    }

    if (!providerMessageId) {
      return {
        ok: false,
        error: {
          code: EMAIL_ERROR_CODES.EMAIL_INVALID_RECIPIENT_OR_PARAMS,
          message: 'Provider message ID is required to retrieve status.',
          retryable: false,
        },
      };
    }

    try {
      const getPromise = this.client.emails.get(providerMessageId);
      const result = await withTimeout(getPromise, this.timeoutMs);

      if (!result || result.error || !result.data) {
        const mapped = mapResendError(result?.error, result?.error?.statusCode, { isStatusCheck: true });
        logger.warn(`[EMAIL:STATUS_ERROR] Code: ${mapped.code}, Message: ${mapped.message}`);
        return {
          ok: false,
          error: mapped,
        };
      }

      return {
        ok: true,
        lastEvent: result.data.last_event || null,
        createdAt: result.data.created_at || null,
        to: result.data.to || null,
      };
    } catch (err) {
      const mapped = mapResendError(err, undefined, { isStatusCheck: true });
      logger.error(`[EMAIL:STATUS_EXCEPTION] Exception thrown: ${err.message}`);
      return {
        ok: false,
        error: mapped,
      };
    }
  }
}

export default ResendEmailProvider;
