import { apiSlice } from '../api/apiSlice';
import type {
  Attendance,
  ApiResponse,
  PaginationMeta,
} from '../../types/models';

export interface MyAttendanceQueryParams {
  from?: string;
  to?: string;
  workingStatus?: string;
  page?: number;
  limit?: number;
}

export interface TeamAttendanceQueryParams {
  from?: string;
  to?: string;
  userId?: string;
  workingStatus?: string;
  verificationStatus?: string;
  overtimeStatus?: string;
  page?: number;
  limit?: number;
}

export interface AdminAttendanceQueryParams extends TeamAttendanceQueryParams {
  role?: string;
}

export interface AttendanceHistoryResult {
  data: Attendance[];
  meta?: PaginationMeta;
}

export interface RequestOvertimePayload {
  id: string;
  requestedMinutes: number;
  reason: string;
}

export interface ReviewVerificationPayload {
  id: string;
  status: 'valid' | 'invalid';
  remarks?: string;
}

export interface ReviewOvertimePayload {
  id: string;
  decision: 'approved' | 'rejected';
  remarks?: string;
}

export const attendanceApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTodayAttendance: builder.query<Attendance | null, void>({
      query: () => '/attendance/today',
      transformResponse: (response: ApiResponse<Attendance | null>) =>
        response.data,
      providesTags: ['Today'],
    }),

    getMyAttendanceHistory: builder.query<
      AttendanceHistoryResult,
      MyAttendanceQueryParams | void
    >({
      query: (params) => ({
        url: '/attendance/me',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<Attendance[]>) => ({
        data: response.data,
        meta: response.meta,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id, _id }) => ({
                type: 'Attendance' as const,
                id: id || _id,
              })),
              'Attendance',
            ]
          : ['Attendance'],
    }),

    getTeamAttendance: builder.query<
      AttendanceHistoryResult,
      TeamAttendanceQueryParams | void
    >({
      query: (params) => ({
        url: '/attendance/team',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<Attendance[]>) => ({
        data: response.data,
        meta: response.meta,
      }),
      providesTags: ['Attendance'],
    }),

    getAllAttendance: builder.query<
      AttendanceHistoryResult,
      AdminAttendanceQueryParams | void
    >({
      query: (params) => ({
        url: '/attendance',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<Attendance[]>) => ({
        data: response.data,
        meta: response.meta,
      }),
      providesTags: ['Attendance'],
    }),

    getAttendanceRecord: builder.query<Attendance, string>({
      query: (id) => `/attendance/${id}`,
      transformResponse: (response: ApiResponse<Attendance>) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'Attendance', id }],
    }),

    punchIn: builder.mutation<Attendance, FormData>({
      query: (formData) => ({
        url: '/attendance/punch-in',
        method: 'POST',
        body: formData,
      }),
      transformResponse: (response: ApiResponse<Attendance>) => response.data,
      invalidatesTags: ['Today', 'Attendance', 'Dashboard', 'Report'],
    }),

    punchOut: builder.mutation<Attendance, FormData>({
      query: (formData) => ({
        url: '/attendance/punch-out',
        method: 'POST',
        body: formData,
      }),
      transformResponse: (response: ApiResponse<Attendance>) => response.data,
      invalidatesTags: [
        'Today',
        'Attendance',
        'Dashboard',
        'Report',
        'Overtime',
      ],
    }),

    requestOvertime: builder.mutation<Attendance, RequestOvertimePayload>({
      query: ({ id, requestedMinutes, reason }) => ({
        url: `/attendance/${id}/overtime`,
        method: 'POST',
        body: { requestedMinutes, reason },
      }),
      transformResponse: (response: ApiResponse<Attendance>) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        'Today',
        'Attendance',
        'Overtime',
        'Dashboard',
        { type: 'Attendance', id },
      ],
    }),

    reviewVerification: builder.mutation<Attendance, ReviewVerificationPayload>({
      query: ({ id, status, remarks }) => ({
        url: `/attendance/${id}/verification`,
        method: 'PATCH',
        body: { status, remarks },
      }),
      transformResponse: (response: ApiResponse<Attendance>) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        'Today',
        'Attendance',
        'Dashboard',
        'Report',
        'Overtime',
        { type: 'Attendance', id },
      ],
    }),

    getPendingOvertime: builder.query<
      AttendanceHistoryResult,
      { page?: number; limit?: number } | void
    >({
      query: (params) => ({
        url: '/overtime/pending',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<Attendance[]>) => ({
        data: response.data,
        meta: response.meta,
      }),
      providesTags: ['Overtime', 'Attendance'],
    }),

    reviewOvertime: builder.mutation<Attendance, ReviewOvertimePayload>({
      query: ({ id, decision, remarks }) => ({
        url: `/attendance/${id}/overtime/review`,
        method: 'PATCH',
        body: { decision, remarks },
      }),
      transformResponse: (response: ApiResponse<Attendance>) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        'Today',
        'Attendance',
        'Overtime',
        'Dashboard',
        'Report',
        { type: 'Attendance', id },
      ],
    }),
  }),
});

export const {
  useGetTodayAttendanceQuery,
  useGetMyAttendanceHistoryQuery,
  useGetTeamAttendanceQuery,
  useGetAllAttendanceQuery,
  useGetAttendanceRecordQuery,
  usePunchInMutation,
  usePunchOutMutation,
  useRequestOvertimeMutation,
  useReviewVerificationMutation,
  useGetPendingOvertimeQuery,
  useReviewOvertimeMutation,
} = attendanceApi;
