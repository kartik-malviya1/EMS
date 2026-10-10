import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ProtectedRoute } from '../routes/ProtectedRoute';
import authReducer from '../features/auth/authSlice';
import themeReducer from '../features/theme/themeSlice';
import { apiSlice } from '../features/api/apiSlice';
import type { User } from '../types/models';

const createMockStore = (initialAuthState: {
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
}) => {
  return configureStore({
    reducer: {
      [apiSlice.reducerPath]: apiSlice.reducer,
      auth: authReducer,
      theme: themeReducer,
    },
    preloadedState: {
      auth: initialAuthState,
      theme: { theme: 'light' as const },
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(apiSlice.middleware),
  });
};

describe('ProtectedRoute Component', () => {
  it('redirects unauthenticated user to /login', () => {
    const store = createMockStore({
      user: null,
      isAuthenticated: false,
      isInitialized: true,
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/employee']}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route
              path="/employee"
              element={
                <ProtectedRoute withShell={false}>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders protected content when user is authenticated with allowed role', () => {
    const mockEmployee: User = {
      id: 'emp-1',
      name: 'Jane Doe',
      email: 'jane@company.com',
      role: 'employee',
      isActive: true,
    };

    const store = createMockStore({
      user: mockEmployee,
      isAuthenticated: true,
      isInitialized: true,
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/employee']}>
          <Routes>
            <Route
              path="/employee"
              element={
                <ProtectedRoute allowedRoles={['employee']} withShell={false}>
                  <div>Employee Secret Dashboard</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Employee Secret Dashboard')).toBeInTheDocument();
  });

  it('redirects user to role default page if role is not allowed for route', () => {
    const mockEmployee: User = {
      id: 'emp-1',
      name: 'Jane Doe',
      email: 'jane@company.com',
      role: 'employee',
      isActive: true,
    };

    const store = createMockStore({
      user: mockEmployee,
      isAuthenticated: true,
      isInitialized: true,
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/employee" element={<div>Employee Default Dashboard</div>} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']} withShell={false}>
                  <div>Admin Control Panel</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    // Employee should be redirected to /employee
    expect(screen.getByText('Employee Default Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Admin Control Panel')).not.toBeInTheDocument();
  });
});
