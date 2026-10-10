import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { LoginPage } from '../pages/LoginPage';
import { SignupPage } from '../pages/SignupPage';
import { apiSlice } from '../features/api/apiSlice';
import authReducer from '../features/auth/authSlice';
import themeReducer from '../features/theme/themeSlice';

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

describe('Auth Forms Server Error Surfacing', () => {
  let store: ReturnType<typeof createTestStore>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    store = createTestStore();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('LoginPage surfaces server error message when login fails', async () => {
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : input.toString();

      if (url.includes('/auth/login')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: false,
              error: {
                code: 'ACCOUNT_INACTIVE',
                message: 'Your account has been deactivated. Please contact an administrator.',
              },
            }),
            {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        );
      }

      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </Provider>
    );

    const emailInput = screen.getByLabelText(/Work Email/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getByRole('button', { name: /Sign In/i });

    await user.type(emailInput, 'inactive@company.com');
    await user.type(passwordInput, 'Password123');
    await user.click(submitBtn);

    expect(
      await screen.findByText(/Your account has been deactivated/i)
    ).toBeInTheDocument();
  });

  it('SignupPage surfaces server error and maps field validation details', async () => {
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : input.toString();

      if (url.includes('/auth/signup')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Validation failed on submitted fields',
                details: [
                  {
                    path: 'email',
                    message: 'Corporate email domain is required',
                  },
                ],
              },
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        );
      }

      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <MemoryRouter>
          <SignupPage />
        </MemoryRouter>
      </Provider>
    );

    const nameInput = screen.getByLabelText(/Full Name/i);
    const emailInput = screen.getByLabelText(/Work Email/i);
    const passwordInput = screen.getByLabelText(/^Password/i);
    const confirmPasswordInput = screen.getByLabelText(/Confirm Password/i);
    const submitBtn = screen.getByRole('button', { name: /Sign Up/i });

    await user.type(nameInput, 'Alex Morgan');
    await user.type(emailInput, 'alex@personal.com');
    await user.type(passwordInput, 'Password123');
    await user.type(confirmPasswordInput, 'Password123');
    await user.click(submitBtn);

    // Global alert message
    expect(
      await screen.findByText(/Validation failed on submitted fields/i)
    ).toBeInTheDocument();

    // Field-specific validation message mapped to the field
    expect(
      await screen.findByText(/Corporate email domain is required/i)
    ).toBeInTheDocument();
  });
});
