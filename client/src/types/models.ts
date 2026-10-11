export type Role = 'employee' | 'manager' | 'admin';

export type WorkingStatus = 'in_progress' | 'completed' | 'incomplete' | 'missed';

export type VerificationStatus = 'pending' | 'valid' | 'invalid';

export type OvertimeStatus =
  | 'not_requested'
  | 'pending'
  | 'approved'
  | 'rejected';

export type AccountStatus = 'invited' | 'active' | 'suspended' | 'deactivated';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export type EmailDeliveryStatus = 'pending' | 'accepted' | 'failed';

export interface User {
  _id?: string;
  id: string;
  name: string;
  email: string;
  role: Role;
  employeeId?: string;
  department?: string;
  designation?: string;
  dateOfJoining?: string | null;
  accountStatus?: AccountStatus;
  managerId?: string | User | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Invitation {
  _id?: string;
  id?: string;
  userId?: string | User;
  email: string;
  name: string;
  role: 'employee' | 'manager';
  employeeId?: string;
  department?: string;
  designation?: string;
  invitedBy?: string | User;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  lastSentAt?: string;
  resendCount?: number;
  emailDeliveryStatus?: EmailDeliveryStatus;
  emailProviderMessageId?: string | null;
  emailLastEvent?: string | null;
  emailLastEventAt?: string | null;
  emailLastError?: {
    code: string;
    message: string;
    at?: string;
    outcomeUnknown?: boolean;
  } | null;
  emailAttempt?: number;
  createdAt: string;
  updatedAt: string;
}


export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  distanceFromOfficeMeters?: number;
  withinGeofence?: boolean;
}

export interface PunchInfo {
  at: string;
  location: Coordinates;
}

export interface VerificationData {
  status: VerificationStatus;
  reviewedBy?: User | string | null;
  reviewedAt?: string | null;
  remarks?: string | null;
  history?: Array<{
    status: VerificationStatus;
    reviewedBy?: User | string;
    reviewedAt: string;
    remarks?: string | null;
  }>;
}

export interface OvertimeData {
  status: OvertimeStatus;
  requestedMinutes?: number | null;
  reason?: string | null;
  requestedAt?: string | null;
  reviewedBy?: User | string | null;
  reviewedAt?: string | null;
  remarks?: string | null;
  history?: Array<{
    status: OvertimeStatus;
    requestedMinutes?: number;
    reason?: string;
    requestedAt?: string;
    reviewedBy?: User | string;
    reviewedAt?: string;
    remarks?: string | null;
  }>;
}

export interface Attendance {
  _id?: string;
  id: string;
  employeeId: User | string;
  workDate: string;
  punchIn: PunchInfo;
  punchOut?: PunchInfo | null;
  workedMinutes?: number | null;
  workingStatus: WorkingStatus;
  closedBy?: string | null;
  verification: VerificationData;
  overtime: OvertimeData;
  createdAt?: string;
  updatedAt?: string;
}

export interface Notification {
  _id?: string;
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: {
    attendanceId?: string;
    workDate?: string;
  };
  readAt?: string | null;
  createdAt: string;
}

export interface GeofenceSettings {
  enabled: boolean;
  officeLatitude: number;
  officeLongitude: number;
  radiusMeters: number;
  maxAccuracyMeters: number;
  updatedAt?: string;
}

export interface EmployeeDashboardMetrics {
  completedDays: number;
  incompleteDays: number;
  missedDays: number;
  totalWorkedMinutes: number;
  pendingOvertime: number;
  approvedOvertimeMinutes: number;
  invalidDays: number;
}

export interface ManagerDashboardMetrics {
  teamSize: number;
  punchedIn: number;
  notYetPunchedIn: number;
  completed: number;
  incomplete: number;
  pendingVerification: number;
  pendingOvertime: number;
}

export interface AdminDashboardMetrics {
  totalUsers: {
    employee: number;
    manager: number;
    admin: number;
  };
  activeUsers: number;
  today: {
    punchedIn: number;
    completed: number;
    incomplete: number;
    missed: number;
    pendingVerification: number;
    pendingOvertime: number;
  };
}

export type DashboardSummary =
  | EmployeeDashboardMetrics
  | ManagerDashboardMetrics
  | AdminDashboardMetrics;

export interface ReportRow {
  attendanceId: string;
  employeeName: string;
  employeeEmail: string;
  workDate: string;
  punchInAt: string;
  punchOutAt: string | null;
  punchInLocation: string;
  punchOutLocation: string;
  workedMinutes: number | null;
  workedHours: number | null;
  workingStatus: WorkingStatus;
  verificationStatus: VerificationStatus;
  verificationRemarks?: string | null;
  verifiedBy?: string | null;
  verificationAt?: string | null;
  overtimeStatus: OvertimeStatus;
  overtimeMinutes?: number;
  overtimeHours?: number;
  overtimeReason?: string | null;
  overtimeRemarks?: string | null;
  hasPunchInSelfie: boolean;
  hasPunchOutSelfie: boolean;
  punchInSelfieUrl?: string | null;
  punchOutSelfieUrl?: string | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type LeaveType = 'annual' | 'sick' | 'casual' | 'unpaid';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type HalfDayPeriod = 'first_half' | 'second_half';

export interface LeaveRequest {
  _id: string;
  id?: string;
  userId: string | User;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  halfDayPeriod?: HalfDayPeriod | null;
  daysCount: number;
  reason: string;
  status: LeaveStatus;
  reviewedBy?: string | User | null;
  reviewedAt?: string | null;
  reviewerRemarks?: string;
  appliedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
  error?: {
    code: string;
    message: string;
    details?: unknown[];
  };
}
