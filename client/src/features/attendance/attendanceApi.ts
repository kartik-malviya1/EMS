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

export interface AttendanceHistoryResult {
  data: Attendance[];
  meta?: PaginationMeta;
}

export interface RequestOvertimePayload {
  id: string;
  requestedMinutes: number;
  reason: string;
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
              ...result.data.map(({ id }) => ({
                type: 'Attendance' as const,
                id,
              })),
              'Attendance',
            ]
          : ['Attendance'],
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
      invalidatesTags: ['Today', 'Attendance', 'Dashboard', 'Report', 'Overtime'],
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
  }),
});

export const {
  useGetTodayAttendanceQuery,
  useGetMyAttendanceHistoryQuery,
  usePunchInMutation,
  usePunchOutMutation,
  useRequestOvertimeMutation,
} = attendanceApi;
