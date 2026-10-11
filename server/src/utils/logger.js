const isTest = process.env.NODE_ENV === 'test';

const SENSITIVE_KEYS = new Set([
  'token',
  'rawtoken',
  'invitationtoken',
  'authorization',
  'apikey',
  'resend_api_key',
  'resendapikey',
  'password',
  'passwordhash',
]);

/**
 * Deeply redacts sensitive keys and secret patterns from logs.
 */
export const redactSensitiveData = (val) => {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    return val
      .replace(/re_[A-Za-z0-9_]{10,}/g, '[REDACTED_API_KEY]')
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
      .replace(/([?&]token=)[a-f0-9]{32,}/gi, '$1[REDACTED]');
  }
  if (Array.isArray(val)) {
    return val.map(redactSensitiveData);
  }
  if (typeof val === 'object' && val.constructor === Object) {
    const copy = {};
    for (const [k, v] of Object.entries(val)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        copy[k] = '[REDACTED]';
      } else {
        copy[k] = redactSensitiveData(v);
      }
    }
    return copy;
  }
  return val;
};

export const logger = {
  info: (...args) => {
    if (!isTest) console.log('[INFO]', ...args.map(redactSensitiveData));
  },
  warn: (...args) => {
    if (!isTest) console.warn('[WARN]', ...args.map(redactSensitiveData));
  },
  error: (...args) => {
    if (!isTest) console.error('[ERROR]', ...args.map(redactSensitiveData));
  },
  debug: (...args) => {
    if (!isTest && process.env.NODE_ENV === 'development') {
      console.debug('[DEBUG]', ...args.map(redactSensitiveData));
    }
  },
};
