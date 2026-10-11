export const ROLES = {
  EMPLOYEE: 'employee',
  MANAGER: 'manager',
  ADMIN: 'admin',
};

export const ROLE_LIST = [ROLES.EMPLOYEE, ROLES.MANAGER, ROLES.ADMIN];

export const WORKING_STATUS = {
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  INCOMPLETE: 'incomplete',
  MISSED: 'missed',
};

export const WORKING_STATUS_LIST = [
  WORKING_STATUS.IN_PROGRESS,
  WORKING_STATUS.COMPLETED,
  WORKING_STATUS.INCOMPLETE,
  WORKING_STATUS.MISSED,
];

export const CLOSED_BY = {
  EMPLOYEE: 'employee',
  SYSTEM: 'system',
};

export const CLOSED_BY_LIST = [CLOSED_BY.EMPLOYEE, CLOSED_BY.SYSTEM];

export const VERIFICATION_STATUS = {
  PENDING: 'pending',
  VALID: 'valid',
  INVALID: 'invalid',
};

export const VERIFICATION_STATUS_LIST = [
  VERIFICATION_STATUS.PENDING,
  VERIFICATION_STATUS.VALID,
  VERIFICATION_STATUS.INVALID,
];

export const OVERTIME_STATUS = {
  NOT_REQUESTED: 'not_requested',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const OVERTIME_STATUS_LIST = [
  OVERTIME_STATUS.NOT_REQUESTED,
  OVERTIME_STATUS.PENDING,
  OVERTIME_STATUS.APPROVED,
  OVERTIME_STATUS.REJECTED,
];

export const NOTIFICATION_TYPES = {
  OVERTIME_REQUESTED: 'overtime_requested',
  OVERTIME_APPROVED: 'overtime_approved',
  OVERTIME_REJECTED: 'overtime_rejected',
  ATTENDANCE_VALID: 'attendance_valid',
  ATTENDANCE_INVALID: 'attendance_invalid',
  MISSED_PUNCH_IN: 'missed_punch_in',
  MISSED_PUNCH_OUT: 'missed_punch_out',
  ATTENDANCE_AUTO_CLOSED: 'attendance_auto_closed',
};

export const NOTIFICATION_TYPE_LIST = Object.values(NOTIFICATION_TYPES);

export const DEFAULT_BUSINESS_TIMEZONE = 'Asia/Kolkata';
export const STANDARD_SHIFT_MINUTES = 480;
export const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];

export const ACCOUNT_STATUS = {
  INVITED: 'invited',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DEACTIVATED: 'deactivated',
};

export const ACCOUNT_STATUS_LIST = Object.values(ACCOUNT_STATUS);

export const INVITATION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
};

export const INVITATION_STATUS_LIST = Object.values(INVITATION_STATUS);

export const EMAIL_DELIVERY_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  FAILED: 'failed',
  DEV_LINK: 'dev_link',
};

export const EMAIL_DELIVERY_STATUS_LIST = Object.values(EMAIL_DELIVERY_STATUS);

export const AUDIT_ACTIONS = {
  INVITATION_CREATED: 'invitation_created',
  INVITATION_EMAIL_ACCEPTED: 'invitation_email_accepted',
  INVITATION_EMAIL_SENT: 'invitation_email_accepted', // Alias for backward compatibility
  INVITATION_EMAIL_FAILED: 'invitation_email_failed',
  INVITATION_RESENT: 'invitation_resent',
  INVITATION_REVOKED: 'invitation_revoked',
  INVITATION_ACCEPTED: 'invitation_accepted',
  ROLE_CHANGED: 'role_changed',
  MANAGER_CHANGED: 'manager_changed',
  ACCOUNT_SUSPENDED: 'account_suspended',
  ACCOUNT_REACTIVATED: 'account_reactivated',
  ACCOUNT_DEACTIVATED: 'account_deactivated',
};

export const AUDIT_ACTION_LIST = Object.values(AUDIT_ACTIONS);

