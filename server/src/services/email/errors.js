export const EMAIL_ERROR_CODES = {
  EMAIL_NOT_CONFIGURED: 'EMAIL_NOT_CONFIGURED',
  EMAIL_INVALID_API_KEY: 'EMAIL_INVALID_API_KEY',
  EMAIL_SANDBOX_RECIPIENT_RESTRICTED: 'EMAIL_SANDBOX_RECIPIENT_RESTRICTED',
  EMAIL_DOMAIN_NOT_VERIFIED: 'EMAIL_DOMAIN_NOT_VERIFIED',
  EMAIL_RATE_LIMITED: 'EMAIL_RATE_LIMITED',
  EMAIL_QUOTA_EXCEEDED: 'EMAIL_QUOTA_EXCEEDED',
  EMAIL_INVALID_RECIPIENT_OR_PARAMS: 'EMAIL_INVALID_RECIPIENT_OR_PARAMS',
  EMAIL_PROVIDER_ERROR: 'EMAIL_PROVIDER_ERROR',
  EMAIL_TIMEOUT: 'EMAIL_TIMEOUT',
};

/**
 * Maps raw Resend API errors or SDK errors to stable internal codes and actionable admin messages.
 * Never includes secrets or raw API keys in messages.
 */
export const mapResendError = (err, statusCode) => {
  if (!err) {
    return {
      code: EMAIL_ERROR_CODES.EMAIL_PROVIDER_ERROR,
      message: 'Unknown email provider failure. Please verify your email configuration.',
      retryable: true,
      outcomeUnknown: false,
    };
  }

  const name = String(err.name || '').toLowerCase();
  const rawMessage = String(err.message || '');
  const status = Number(statusCode || err.statusCode || err.status || 0);

  // 1. Sandbox recipient restriction (403 validation_error: only send testing emails to your own email address)
  if (
    (status === 403 && rawMessage.includes('only send testing emails to your own email address')) ||
    rawMessage.includes('only send testing emails to your own email address') ||
    (rawMessage.includes('testing emails') && rawMessage.includes('resend.dev'))
  ) {
    return {
      code: EMAIL_ERROR_CODES.EMAIL_SANDBOX_RECIPIENT_RESTRICTED,
      message:
        "Resend's test sender can only deliver to your own Resend account email. Verify a domain at resend.com/domains and set EMAIL_FROM to an address on it to invite other people.",
      retryable: false,
      outcomeUnknown: false,
    };
  }

  // 2. Sending domain not verified
  if (
    (status === 403 && (rawMessage.includes('not verified') || rawMessage.includes('verify your domain'))) ||
    name === 'domain_not_verified' ||
    rawMessage.includes('domain is not verified')
  ) {
    return {
      code: EMAIL_ERROR_CODES.EMAIL_DOMAIN_NOT_VERIFIED,
      message:
        'The sending domain is not verified with Resend. Add and verify your domain in Resend DNS settings before sending.',
      retryable: false,
      outcomeUnknown: false,
    };
  }

  // 3. API key invalid / restricted / suspended / permission missing
  if (
    status === 401 ||
    name === 'missing_api_key' ||
    name === 'restricted_api_key' ||
    name === 'suspended_api_key' ||
    name === 'invalid_permission' ||
    (status === 403 && (rawMessage.toLowerCase().includes('api key') || name.includes('api_key')))
  ) {
    return {
      code: EMAIL_ERROR_CODES.EMAIL_INVALID_API_KEY,
      message:
        'The configured Resend API key is invalid, suspended, or missing sending permissions. Verify or rotate the key in your Resend dashboard.',
      retryable: false,
      outcomeUnknown: false,
    };
  }

  // 4. Rate limit exceeded (requests per second)
  if (status === 429 && (name === 'rate_limit_exceeded' || rawMessage.toLowerCase().includes('rate limit'))) {
    return {
      code: EMAIL_ERROR_CODES.EMAIL_RATE_LIMITED,
      message:
        'Resend rate limit exceeded (requests per second limit reached). Please wait a moment before trying again.',
      retryable: true,
      outcomeUnknown: false,
    };
  }

  // 5. Daily or monthly quota exceeded
  if (
    name === 'daily_quota_exceeded' ||
    name === 'monthly_quota_exceeded' ||
    name === 'email_above_quota' ||
    (status === 429 && rawMessage.toLowerCase().includes('quota'))
  ) {
    return {
      code: EMAIL_ERROR_CODES.EMAIL_QUOTA_EXCEEDED,
      message:
        'Resend email sending quota exceeded for your account plan. Upgrade your plan or wait for your quota to reset.',
      retryable: false,
      outcomeUnknown: false,
    };
  }

  // 6. Validation error / invalid recipient / missing parameters
  if (
    name === 'validation_error' ||
    name === 'invalid_parameter' ||
    name === 'missing_required_field' ||
    name === 'missing_required_parameter' ||
    name === 'invalid_idempotency_key' ||
    name === 'invalid_attachment' ||
    status === 400 ||
    status === 422
  ) {
    return {
      code: EMAIL_ERROR_CODES.EMAIL_INVALID_RECIPIENT_OR_PARAMS,
      message: rawMessage || 'Invalid email recipient or parameters.',
      retryable: false,
      outcomeUnknown: false,
    };
  }

  // 7. Timeout
  if (err.code === 'EMAIL_TIMEOUT' || name === 'timeout' || rawMessage.toLowerCase().includes('timed out')) {
    return {
      code: EMAIL_ERROR_CODES.EMAIL_TIMEOUT,
      message:
        'Email delivery timed out while contacting Resend. The email might still be processed; retrying reuses the same attempt to prevent duplicates.',
      retryable: true,
      outcomeUnknown: true,
    };
  }

  // 8. Provider server / network error fallback
  return {
    code: EMAIL_ERROR_CODES.EMAIL_PROVIDER_ERROR,
    message: rawMessage || 'Email provider delivery failure. Please try again later.',
    retryable: true,
    outcomeUnknown: false,
  };
};
