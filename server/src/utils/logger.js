const isTest = process.env.NODE_ENV === 'test';

export const logger = {
  info: (...args) => {
    if (!isTest) console.log('[INFO]', ...args);
  },
  warn: (...args) => {
    if (!isTest) console.warn('[WARN]', ...args);
  },
  error: (...args) => {
    if (!isTest) console.error('[ERROR]', ...args);
  },
  debug: (...args) => {
    if (!isTest && process.env.NODE_ENV === 'development') {
      console.debug('[DEBUG]', ...args);
    }
  },
};
