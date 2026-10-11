import { apiSlice } from '../api/apiSlice';
import { setCredentials, logoutUser } from './authSlice';
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
  token?: string;
}

export interface SocketTokenResponse {
  socketToken: string;
}

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMe: builder.query<User, void>({
      query: () => '/auth/me',
      transformResponse: (response: ApiResponse<User>) => response.data,
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data) {
            dispatch(setCredentials({ user: data }));
          }
        } catch {
          // ignore
        }
      },
      providesTags: ['Me'],
    }),

    login: builder.mutation<User, LoginRequest>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      transformResponse: (
        response: ApiResponse<User | { user: User; token?: string } | (User & { token?: string })>
      ) => {
        const raw = response.data as { user?: User; token?: string } & User;
        const user: User = raw.user || raw;
        const token: string | undefined = raw.token;
        if (token && typeof window !== 'undefined') {
          localStorage.setItem('ems_token', token);
        }
        return user;
      },
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const token = typeof window !== 'undefined' ? localStorage.getItem('ems_token') || undefined : undefined;
          dispatch(setCredentials({ user: data, token }));
          dispatch(authApi.util.upsertQueryData('getMe', undefined, data));
        } catch {
          // ignore
        }
      },
      invalidatesTags: ['Me', 'Today', 'Attendance', 'Dashboard', 'Notification'],
    }),

    signup: builder.mutation<User, SignupRequest>({
      query: (payload) => ({
        url: '/auth/signup',
        method: 'POST',
        body: payload,
      }),
      transformResponse: (
        response: ApiResponse<User | { user: User; token?: string } | (User & { token?: string })>
      ) => {
        const raw = response.data as { user?: User; token?: string } & User;
        const user: User = raw.user || raw;
        const token: string | undefined = raw.token;
        if (token && typeof window !== 'undefined') {
          localStorage.setItem('ems_token', token);
        }
        return user;
      },
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const token = typeof window !== 'undefined' ? localStorage.getItem('ems_token') || undefined : undefined;
          dispatch(setCredentials({ user: data, token }));
          dispatch(authApi.util.upsertQueryData('getMe', undefined, data));
        } catch {
          // ignore
        }
      },
      invalidatesTags: ['Me'],
    }),

    logout: builder.mutation<void, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          if (typeof window !== 'undefined') {
            localStorage.removeItem('ems_token');
          }
          dispatch(logoutUser());
          dispatch(apiSlice.util.resetApiState());
        } catch {
          // ignore
        }
      },
      invalidatesTags: ['Me', 'Today', 'Attendance', 'Dashboard', 'Notification'],
    }),

    getSocketToken: builder.query<string, void>({
      query: () => '/auth/socket-token',
      transformResponse: (response: ApiResponse<SocketTokenResponse>) =>
        response.data.socketToken,
    }),

    getAuthConfig: builder.query<{ publicRegistrationEnabled: boolean }, void>({
      query: () => '/auth/config',
      transformResponse: (response: ApiResponse<{ publicRegistrationEnabled: boolean }>) =>
        response.data,
    }),

    requestInvitationLink: builder.mutation<{ message: string }, { email: string }>({
      query: (body) => ({
        url: '/auth/invitations/request-link',
        method: 'POST',
        body,
      }),
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
  useGetAuthConfigQuery,
  useRequestInvitationLinkMutation,
} = authApi;
