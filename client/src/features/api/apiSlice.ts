import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { toast } from 'sonner';
import { logoutUser } from '../auth/authSlice';

const getBaseUrl = () => {
  if (
    typeof window !== 'undefined' &&
    window.location?.origin &&
    window.location.origin !== 'null'
  ) {
    return `${window.location.origin}/api`;
  }
  return '/api';
};

const baseQuery = fetchBaseQuery({
  baseUrl: getBaseUrl(),
  credentials: 'include',
});

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    const url = typeof args === 'string' ? args : args.url;
    // Don't toast or clear for login failure or initial session probe
    if (
      !url.includes('/auth/login') &&
      !url.includes('/auth/signup') &&
      !url.includes('/auth/me')
    ) {
      api.dispatch(logoutUser());
      toast.error('Session expired or unauthenticated. Please log in.');
    }
  }

  return result;
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Me',
    'User',
    'Attendance',
    'Today',
    'Overtime',
    'Report',
    'Dashboard',
    'Notification',
    'Settings',
  ],
  endpoints: () => ({}),
});
