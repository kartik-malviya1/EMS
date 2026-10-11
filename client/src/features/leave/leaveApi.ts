import { apiSlice } from '../api/apiSlice';
import type {
  LeaveRequest,
  LeaveType,
  HalfDayPeriod,
  LeaveStatus,
  PaginationMeta,
} from '../../types/models';

export interface ApplyLeaveRequest {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  isHalfDay?: boolean;
  halfDayPeriod?: HalfDayPeriod | null;
  reason: string;
}

export interface ReviewLeaveRequest {
  id: string;
  action: 'approve' | 'reject';
  remarks?: string;
}

export interface LeaveQueryParams {
  status?: LeaveStatus | '';
  leaveType?: LeaveType | '';
  from?: string;
  to?: string;
  userId?: string;
  page?: number;
  limit?: number;
}

export interface LeaveListResponse {
  data: LeaveRequest[];
  meta: PaginationMeta;
}

export const leaveApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMyLeaves: builder.query<LeaveListResponse, LeaveQueryParams | void>({
      query: (params) => ({
        url: '/leave/me',
        params: params || {},
      }),
      transformResponse: (response: { data: LeaveRequest[]; meta: PaginationMeta }) => ({
        data: response.data,
        meta: response.meta,
      }),
      providesTags: ['Leave'],
    }),

    getTeamLeaves: builder.query<LeaveListResponse, LeaveQueryParams | void>({
      query: (params) => ({
        url: '/leave/team',
        params: params || {},
      }),
      transformResponse: (response: { data: LeaveRequest[]; meta: PaginationMeta }) => ({
        data: response.data,
        meta: response.meta,
      }),
      providesTags: ['Leave'],
    }),

    getAllLeaves: builder.query<LeaveListResponse, LeaveQueryParams | void>({
      query: (params) => ({
        url: '/leave',
        params: params || {},
      }),
      transformResponse: (response: { data: LeaveRequest[]; meta: PaginationMeta }) => ({
        data: response.data,
        meta: response.meta,
      }),
      providesTags: ['Leave'],
    }),

    applyLeave: builder.mutation<LeaveRequest, ApplyLeaveRequest>({
      query: (body) => ({
        url: '/leave',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: LeaveRequest }) => response.data,
      invalidatesTags: ['Leave'],
    }),

    cancelLeave: builder.mutation<LeaveRequest, string>({
      query: (id) => ({
        url: `/leave/${id}/cancel`,
        method: 'PATCH',
      }),
      transformResponse: (response: { data: LeaveRequest }) => response.data,
      invalidatesTags: ['Leave'],
    }),

    reviewLeave: builder.mutation<LeaveRequest, ReviewLeaveRequest>({
      query: ({ id, action, remarks }) => ({
        url: `/leave/${id}/review`,
        method: 'PATCH',
        body: { action, remarks },
      }),
      transformResponse: (response: { data: LeaveRequest }) => response.data,
      invalidatesTags: ['Leave'],
    }),
  }),
});

export const {
  useGetMyLeavesQuery,
  useGetTeamLeavesQuery,
  useGetAllLeavesQuery,
  useApplyLeaveMutation,
  useCancelLeaveMutation,
  useReviewLeaveMutation,
} = leaveApi;
