import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extracts a user-facing actionable error message from RTK Query / backend ApiError payloads.
 * Handles HTTP 409, 429, 502, and specific error codes with helpful fallback messages.
 */
export function getApiErrorMessage(err: unknown, defaultMessage = 'An unexpected error occurred'): string {
  if (!err) return defaultMessage;

  const payload = err as {
    status?: number | string;
    data?: {
      error?: {
        code?: string;
        message?: string;
        details?: { retryAfterSeconds?: number } | unknown;
      };
    };
    message?: string;
    error?: string;
  };

  const errorObj = payload.data?.error;
  const code = errorObj?.code;
  const message = errorObj?.message;
  const status = Number(payload.status);

  // Check specific error codes
  if (code === 'RESEND_COOLDOWN') {
    const details = errorObj?.details as { retryAfterSeconds?: number } | undefined;
    const seconds = details?.retryAfterSeconds;
    if (seconds) {
      return `Please wait ${seconds}s before resending another invitation.`;
    }
    return message || 'Please wait before resending another invitation.';
  }

  if (code === 'RESEND_LIMIT_REACHED') {
    return 'Maximum invitation resend limit reached. Please contact your organization administrator.';
  }

  if (code === 'SEND_IN_PROGRESS') {
    return 'An invitation email send is currently in progress. Please wait a moment.';
  }

  if (code === 'EMAIL_SANDBOX_RECIPIENT_RESTRICTED') {
    return "Resend's test sender can only deliver to your own Resend account email. Verify a domain at resend.com/domains and set EMAIL_FROM to an address on it to invite other people.";
  }

  if (code === 'EMAIL_DOMAIN_NOT_VERIFIED') {
    return 'The sending domain is not verified with Resend. Add and verify your domain in Resend DNS settings.';
  }

  if (code === 'EMAIL_INVALID_API_KEY') {
    return 'The configured Resend API key is invalid, suspended, or missing sending permissions. Verify or rotate the key in your Resend dashboard.';
  }

  if (code === 'EMAIL_TIMEOUT') {
    return 'Email delivery timed out while contacting Resend. It may still arrive; retry reuses the same request to avoid duplicates.';
  }

  if (code === 'EMAIL_RATE_LIMITED') {
    return 'Resend rate limit exceeded (requests per second limit reached). Please wait a moment before trying again.';
  }

  if (code === 'EMAIL_QUOTA_EXCEEDED') {
    return 'Resend email sending quota exceeded for your account plan. Upgrade your plan or wait for quota reset.';
  }

  if (code === 'SIGNUP_DISABLED') {
    return 'Registration is invitation-only. Please contact your administrator for an invitation link.';
  }

  if (message) return message;
  if (typeof payload.error === 'string') return payload.error;
  if (payload.message) return payload.message;

  if (status === 502) {
    return 'Email provider service failed to deliver the email. Please try again.';
  }
  if (status === 429) {
    return 'Too many requests. Please wait before trying again.';
  }

  return defaultMessage;
}
