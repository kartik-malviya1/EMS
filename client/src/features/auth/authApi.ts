import { apiSlice } from '../api/apiSlice';
import type { ApiResponse, User } from '../../types/models';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
}

export interface SocketTokenResponse {
  socketToken: string;
}

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMe: builder.query<User, void>({
      query: () => '/auth/me',
      transformResponse: (response: ApiResponse<User>) => response.data,
      providesTags: ['Me'],
    }),

    login: builder.mutation<User, LoginRequest>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      transformResponse: (response: ApiResponse<User | { user: User }>) =>
        'user' in response.data ? response.data.user : response.data,
      invalidatesTags: ['Me', 'Today', 'Attendance', 'Dashboard', 'Notification'],
    }),

    signup: builder.mutation<User, SignupRequest>({
      query: (payload) => ({
        url: '/auth/signup',
        method: 'POST',
        body: payload,
      }),
      transformResponse: (response: ApiResponse<User | { user: User }>) =>
        'user' in response.data ? response.data.user : response.data,
      invalidatesTags: ['Me'],
    }),

    logout: builder.mutation<void, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: ['Me', 'Today', 'Attendance', 'Dashboard', 'Notification'],
    }),

    getSocketToken: builder.query<string, void>({
      query: () => '/auth/socket-token',
      transformResponse: (response: ApiResponse<SocketTokenResponse>) =>
        response.data.socketToken,
    }),
  }),
});

export const {
  useGetMeQuery,
  useLoginMutation,
  useSignupMutation,
  useLogoutMutation,
  useGetSocketTokenQuery,
  useLazyGetSocketTokenQuery,
} = authApi;
