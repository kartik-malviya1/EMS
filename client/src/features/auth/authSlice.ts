import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '../../types/models';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

const initialState: AuthState = {
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('ems_token') : null,
  isAuthenticated: false,
  isInitialized: false,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; token?: string }>
    ) => {
      state.user = action.payload.user;
      if (action.payload.token) {
        state.token = action.payload.token;
        if (typeof window !== 'undefined') {
          localStorage.setItem('ems_token', action.payload.token);
        }
      }
      state.isAuthenticated = true;
      state.isInitialized = true;
    },
    logoutUser: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.isInitialized = true;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ems_token');
      }
    },
    setInitialized: (state, action: PayloadAction<boolean>) => {
      state.isInitialized = action.payload;
    },
  },
});

export const { setCredentials, logoutUser, setInitialized } = authSlice.actions;
export default authSlice.reducer;
