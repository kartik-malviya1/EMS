export type Role = 'employee' | 'manager' | 'admin';

export type WorkingStatus = 'in_progress' | 'completed' | 'incomplete' | 'missed';

export type VerificationStatus = 'pending' | 'valid' | 'invalid';

export type OvertimeStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface User {
  _id?: string;
  id: string;
  name: string;
  email: string;
  role: Role;
  managerId?: string | User | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  overtimeStatus: OvertimeStatus;
  hasPunchInSelfie: boolean;
  hasPunchOutSelfie: boolean;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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
