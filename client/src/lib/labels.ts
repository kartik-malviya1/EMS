import { DateTime } from 'luxon';
import type {
  Role,
  WorkingStatus,
  VerificationStatus,
  OvertimeStatus,
  LeaveStatus,
  InvitationStatus,
  EmailDeliveryStatus,
} from '../types/models';

export const BUSINESS_TIMEZONE = 'Asia/Kolkata';
export const EMPTY_GLYPH = '—';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  employee: 'Employee',
};

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  pending: 'Awaiting activation',
  accepted: 'Activated',
  expired: 'Expired',
  revoked: 'Revoked',
};

export const EMAIL_DELIVERY_STATUS_LABELS: Record<EmailDeliveryStatus, string> = {
  pending: 'Sending…',
  accepted: 'Email sent',
  failed: 'Failed to send',
};

export const EMAIL_DELIVERY_TOOLTIPS: Record<EmailDeliveryStatus, string> = {
  pending: 'Invitation email dispatch is in progress.',
  accepted: 'Sent via Resend. Delivery not confirmed yet.',
  failed: 'Email delivery failed. Inspect error details for troubleshooting.',
};

export const EMAIL_LAST_EVENT_LABELS: Record<string, string> = {
  delivered: 'Delivered',
  bounced: 'Bounced',
  delayed: 'Delayed',
  complained: 'Marked as spam',
  opened: 'Opened',
  clicked: 'Clicked',
};

export const WORKING_STATUS_LABELS: Record<WorkingStatus, string> = {
  in_progress: 'In progress',
  completed: 'Completed',
  incomplete: 'Incomplete',
  missed: 'Missed',
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  pending: 'Pending review',
  valid: 'Valid',
  invalid: 'Invalid',
};

export const OVERTIME_STATUS_LABELS: Record<OvertimeStatus, string> = {
  not_requested: 'Not requested',
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const SOCKET_STATUS_LABELS: Record<'connected' | 'connecting' | 'disconnected', string> = {
  connected: 'Connected',
  connecting: 'Reconnecting',
  disconnected: 'Offline',
};

/**
 * Returns clean human-readable text for a role.
 */
export function formatRole(role?: string | null): string {
  if (!role) return EMPTY_GLYPH;
  const key = role.toLowerCase() as Role;
  return ROLE_LABELS[key] || role;
}

/**
 * Returns human-readable label for invitation status.
 */
export function formatInvitationStatus(status?: string | null): string {
  if (!status) return EMPTY_GLYPH;
  const key = status.toLowerCase() as InvitationStatus;
  return INVITATION_STATUS_LABELS[key] || status;
}

/**
 * Returns human-readable label for email delivery status (never "Accepted").
 */
export function formatEmailDeliveryStatus(status?: string | null): string {
  if (!status) return EMPTY_GLYPH;
  const key = status.toLowerCase() as EmailDeliveryStatus;
  return EMAIL_DELIVERY_STATUS_LABELS[key] || status;
}

/**
 * Returns human-readable label for provider last delivery event.
 */
export function formatProviderEvent(event?: string | null): string {
  if (!event) return 'Not checked yet';
  const key = event.toLowerCase();
  if (EMAIL_LAST_EVENT_LABELS[key]) {
    return EMAIL_LAST_EVENT_LABELS[key];
  }
  return event.charAt(0).toUpperCase() + event.slice(1);
}

/**
 * Formats a date/time into unambiguous "12 Oct 2026, 10:18 AM" format in the business timezone.
 */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  zone: string = BUSINESS_TIMEZONE
): string {
  if (!value) return EMPTY_GLYPH;

  try {
    let dt: DateTime;
    if (typeof value === 'string') {
      dt = DateTime.fromISO(value, { zone });
      if (!dt.isValid) {
        dt = DateTime.fromRFC2822(value, { zone });
      }
      if (!dt.isValid) {
        dt = DateTime.fromSQL(value, { zone });
      }
    } else if (typeof value === 'number') {
      dt = DateTime.fromMillis(value, { zone });
    } else {
      dt = DateTime.fromJSDate(value, { zone });
    }

    if (!dt.isValid) return EMPTY_GLYPH;
    return dt.setZone(zone).toFormat('dd MMM yyyy, hh:mm a');
  } catch {
    return EMPTY_GLYPH;
  }
}

/**
 * Formats a date into unambiguous "12 Oct 2026" format in the business timezone.
 */
export function formatDate(
  value: string | number | Date | null | undefined,
  zone: string = BUSINESS_TIMEZONE
): string {
  if (!value) return EMPTY_GLYPH;

  try {
    let dt: DateTime;
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        dt = DateTime.fromISO(value, { zone });
      } else {
        dt = DateTime.fromISO(value, { zone });
        if (!dt.isValid) dt = DateTime.fromSQL(value, { zone });
      }
    } else if (typeof value === 'number') {
      dt = DateTime.fromMillis(value, { zone });
    } else {
      dt = DateTime.fromJSDate(value, { zone });
    }

    if (!dt.isValid) return EMPTY_GLYPH;
    return dt.setZone(zone).toFormat('dd MMM yyyy');
  } catch {
    return EMPTY_GLYPH;
  }
}

/**
 * Formats a time into unambiguous "10:18 AM" format in the business timezone.
 */
export function formatTime(
  value: string | number | Date | null | undefined,
  zone: string = BUSINESS_TIMEZONE
): string {
  if (!value) return EMPTY_GLYPH;

  try {
    let dt: DateTime;
    if (typeof value === 'string') {
      dt = DateTime.fromISO(value, { zone });
      if (!dt.isValid) dt = DateTime.fromSQL(value, { zone });
    } else if (typeof value === 'number') {
      dt = DateTime.fromMillis(value, { zone });
    } else {
      dt = DateTime.fromJSDate(value, { zone });
    }

    if (!dt.isValid) return EMPTY_GLYPH;
    return dt.setZone(zone).toFormat('hh:mm a');
  } catch {
    return EMPTY_GLYPH;
  }
}
