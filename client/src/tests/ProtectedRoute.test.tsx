import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { toast } from 'sonner';
import { ProtectedRoute } from '../routes/ProtectedRoute';
import authReducer from '../features/auth/authSlice';
import themeReducer from '../features/theme/themeSlice';
import { apiSlice } from '../features/api/apiSlice';
import { LoginPage } from '../pages/LoginPage';
import type { User } from '../types/models';

const createTestStore = () => {
  return configureStore({
    reducer: {
      [apiSlice.reducerPath]: apiSlice.reducer,
      auth: authReducer,
      theme: themeReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(apiSlice.middleware),
  });
};

const getRequestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (typeof input === 'object' && input && 'url' in input) return (input as Request).url;
  return String(input);
};

describe('ProtectedRoute Component & Auth Restoration Lifecycle', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('refresh on a protected URL shows the loading state, then the page, with NO redirect to /login', async () => {
    const mockEmployee: User = {
      id: 'emp-1',
      name: 'Alice Walker',
      email: 'alice.walker@example.com',
      role: 'employee',
      isActive: true,
      accountStatus: 'active',
    };

    let resolveGetMe!: (res: Response) => void;
    const pendingGetMePromise = new Promise<Response>((resolve) => {
      resolveGetMe = resolve;
    });

    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = getRequestUrl(input);
      if (url.includes('/api/auth/me')) {
        return pendingGetMePromise;
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const store = createTestStore();

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/employee']}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
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

    // 1. Initial refresh render: Shows loading state while /auth/me is in flight
    expect(screen.getByTestId('protected-loading')).toBeInTheDocument();
    expect(screen.getByText('Authenticating session...')).toBeInTheDocument();
    // CRITICAL: MUST NOT have redirected to /login during loading!
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(screen.queryByText('Employee Secret Dashboard')).not.toBeInTheDocument();

    // 2. Mock /auth/me returns 200 OK after delay
    resolveGetMe(
      new Response(
        JSON.stringify({
          success: true,
          data: mockEmployee,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    // 3. Page renders protected content, still NO redirect to /login
    expect(await screen.findByText('Employee Secret Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('protected-loading')).not.toBeInTheDocument();
  });

  it('/auth/me 401 redirects to /login exactly once with no toast and the 401 handler ignores the startup call', async () => {
    const toastErrorSpy = vi.spyOn(toast, 'error');

    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = getRequestUrl(input);
      if (url.includes('/api/auth/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: { code: 'UNAUTHENTICATED', message: 'No active session' },
            }),
            {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const store = createTestStore();

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/employee']}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route
              path="/employee"
              element={
                <ProtectedRoute allowedRoles={['employee']} withShell={false}>
                  <div>Employee Dashboard</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    // Redirects to /login after 401 completes
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Employee Dashboard')).not.toBeInTheDocument();

    // The startup /auth/me 401 must NOT trigger any expired session toast or error alert
    expect(toastErrorSpy).not.toHaveBeenCalled();
  });

  it('renders protected content when user is authenticated with allowed role', async () => {
    const mockEmployee: User = {
      id: 'emp-1',
      name: 'Jane Doe',
      email: 'jane@company.com',
      role: 'employee',
      isActive: true,
      accountStatus: 'active',
    };

    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = getRequestUrl(input);
      if (url.includes('/api/auth/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: mockEmployee,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const store = createTestStore();

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/employee']}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
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

    expect(await screen.findByText('Employee Secret Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('redirects user to role default page if role is not allowed for route', async () => {
    const mockEmployee: User = {
      id: 'emp-1',
      name: 'Jane Doe',
      email: 'jane@company.com',
      role: 'employee',
      isActive: true,
      accountStatus: 'active',
    };

    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = getRequestUrl(input);
      if (url.includes('/api/auth/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: mockEmployee,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const store = createTestStore();

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
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
    expect(await screen.findByText('Employee Default Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Admin Control Panel')).not.toBeInTheDocument();
  });

  it('redirects admin navigating to /employee to role default page /admin', async () => {
    const mockAdmin: User = {
      id: 'admin-1',
      name: 'System Admin',
      email: 'admin@company.com',
      role: 'admin',
      isActive: true,
      accountStatus: 'active',
    };

    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = getRequestUrl(input);
      if (url.includes('/api/auth/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: mockAdmin,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const store = createTestStore();

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/employee']}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route path="/admin" element={<div>Admin Default Dashboard</div>} />
            <Route
              path="/employee"
              element={
                <ProtectedRoute allowedRoles={['employee', 'manager']} withShell={false}>
                  <div>Employee Dashboard</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(await screen.findByText('Admin Default Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Employee Dashboard')).not.toBeInTheDocument();
  });

  it('login redirects back to the originally requested URL preserved in router state', async () => {
    const mockEmployee: User = {
      id: 'emp-1',
      name: 'Alice Walker',
      email: 'alice.walker@example.com',
      role: 'employee',
      isActive: true,
      accountStatus: 'active',
    };

    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = getRequestUrl(input);
      if (url.includes('/api/auth/login')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: mockEmployee,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        );
      }
      if (url.includes('/api/auth/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: mockEmployee,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const store = createTestStore();

    // Simulate being redirected to /login with state: { from: { pathname: '/employee/history' } }
    render(
      <Provider store={store}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/login',
              state: { from: { pathname: '/employee/history' } },
            },
          ]}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/employee/history"
              element={<div>Original Employee History Destination</div>}
            />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    // Fill in form and submit
    fireEvent.change(screen.getByLabelText(/Work Email/i), {
      target: { value: 'alice.walker@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'ValidPassword123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    // User should be redirected back to /employee/history!
    expect(
      await screen.findByText('Original Employee History Destination')
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Sign in/i })).not.toBeInTheDocument();
  });
});
