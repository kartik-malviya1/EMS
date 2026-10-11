import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { toast } from 'sonner';
import { logoutUser } from '../auth/authSlice';

// Module-level state to track intentional user logout
let isIntentionalLogout = false;
let lastExpiredToastTime = 0;

export const setIntentionalLogout = (value: boolean) => {
  isIntentionalLogout = value;
};

export const notifySessionExpiredOnce = () => {
  const now = Date.now();
  // Throttle to at most one notification every 10 seconds
  if (now - lastExpiredToastTime > 10000) {
    lastExpiredToastTime = now;
    toast.error('Your session has expired. Please sign in again.', {
      id: 'session-expired-toast',
      duration: 5000,
    });
  }
};

export const getBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }
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
    const isLoginOrAuthPath =
      url.includes('/auth/login') ||
      url.includes('/auth/signup') ||
      url.includes('/auth/invitations') ||
      url.includes('/auth/accept-invitation') ||
      url.includes('/auth/me');

    const pathname = typeof window !== 'undefined' ? window.location?.pathname : '';
    const isOnAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/accept-invitation';

    const state = api.getState() as {
      auth?: { isAuthenticated?: boolean };
    };
    const wasAuthenticated = Boolean(state?.auth?.isAuthenticated);

    // If intentional logout or on login/signup page or probing auth, suppress any session-expired alerts
    if (!isLoginOrAuthPath && !isIntentionalLogout && !isOnAuthPage && wasAuthenticated) {
      api.dispatch(logoutUser());
      api.dispatch(apiSlice.util.resetApiState());
      notifySessionExpiredOnce();
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
    'Invitation',
    'EmailStatus',
    'Leave',
  ],
  endpoints: () => ({}),
});

