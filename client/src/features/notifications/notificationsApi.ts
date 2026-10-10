import { apiSlice } from '../api/apiSlice';
import type {
  Notification,
  ApiResponse,
  PaginationMeta,
} from '../../types/models';

export interface NotificationQueryParams {
  unreadOnly?: boolean | string;
  page?: number;
  limit?: number;
}

export interface NotificationListResult {
  data: Notification[];
  meta?: PaginationMeta;
}

export const notificationsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getNotifications: builder.query<
      NotificationListResult,
      NotificationQueryParams | void
    >({
      query: (params) => ({
        url: '/notifications',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<Notification[]>) => ({
        data: response.data,
        meta: response.meta,
      }),
      providesTags: ['Notification'],
    }),

    getUnreadCount: builder.query<number, void>({
      query: () => '/notifications/unread-count',
      transformResponse: (
        response: ApiResponse<{ unreadCount: number }>
      ) => response.data?.unreadCount ?? 0,
      providesTags: ['Notification'],
    }),

    markNotificationAsRead: builder.mutation<Notification, string>({
      query: (id) => ({
        url: `/notifications/${id}/read`,
        method: 'PATCH',
      }),
      transformResponse: (response: ApiResponse<Notification>) =>
        response.data,
      invalidatesTags: ['Notification'],
    }),

    markAllNotificationsAsRead: builder.mutation<
      { modifiedCount: number },
      void
    >({
      query: () => ({
        url: '/notifications/read-all',
        method: 'PATCH',
      }),
      transformResponse: (
        response: ApiResponse<{ modifiedCount: number }>
      ) => response.data,
      invalidatesTags: ['Notification'],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
} = notificationsApi;
