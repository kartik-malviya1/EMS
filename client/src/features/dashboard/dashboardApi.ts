import { apiSlice } from '../api/apiSlice';
import type { DashboardSummary, ApiResponse } from '../../types/models';

export const dashboardApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardSummary: builder.query<DashboardSummary, void>({
      query: () => '/dashboard/summary',
      transformResponse: (response: ApiResponse<DashboardSummary>) =>
        response.data,
      providesTags: ['Dashboard'],
    }),
  }),
});

export const { useGetDashboardSummaryQuery } = dashboardApi;
