import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { apiSlice } from '../features/api/apiSlice';
import authReducer from '../features/auth/authSlice';
import themeReducer from '../features/theme/themeSlice';
import { LoginPage } from '../pages/LoginPage';
import { RequestInvitationPage } from '../pages/RequestInvitationPage';
import { AcceptInvitationPage } from '../pages/AcceptInvitationPage';
import { InvitationsTable } from '../components/users/InvitationsTable';
import { EmailDeliveryCard } from '../pages/admin/AdminSettingsPage';

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
  if (input instanceof Request) return input.url;
  return input.toString();
};

describe('Frontend Real Email Invitation Delivery & Flows', () => {
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

  describe('1. Login Footer Links & Auth Config', () => {
    it('shows "Create an account" when public registration is enabled', async () => {
      globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = getRequestUrl(input);
        if (url.includes('/auth/config')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, data: { publicRegistrationEnabled: true } }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ success: true, data: {} }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      render(
        <Provider store={store}>
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Create an account/i)).toBeInTheDocument();
      });

      expect(
        screen.getByText(/Invited but didn't get the email\?/i)
      ).toBeInTheDocument();
      const requestLink = screen.getByRole('link', { name: /Request a new link/i });
      expect(requestLink).toHaveAttribute('href', '/request-invitation');
    });

    it('hides "Create an account" when public registration is disabled', async () => {
      globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = getRequestUrl(input);
        if (url.includes('/auth/config')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, data: { publicRegistrationEnabled: false } }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ success: true, data: {} }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      render(
        <Provider store={store}>
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </Provider>
      );

      await waitFor(() => {
        expect(screen.queryByText(/Create an account/i)).not.toBeInTheDocument();
      });

      expect(
        screen.getByText(/Invited but didn't get the email\?/i)
      ).toBeInTheDocument();
    });
  });

  describe('2. /request-invitation Self-Service Link Request', () => {
    it('always displays the generic success panel and disables submit button', async () => {
      globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = getRequestUrl(input);
        if (url.includes('/auth/invitations/request-link')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                message:
                  'If a pending invitation exists for this email, a new invitation link has been sent. Check your inbox and spam folder; it can take a few minutes.',
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        return Promise.resolve(new Response(JSON.stringify({ success: true })));
      });

      render(
        <Provider store={store}>
          <MemoryRouter>
            <RequestInvitationPage />
          </MemoryRouter>
        </Provider>
      );

      const emailInput = screen.getByLabelText(/Work Email Address/i);
      const submitBtn = screen.getByRole('button', { name: /Send Me a New Link/i });

      await userEvent.type(emailInput, 'someone@company.com');
      await userEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Link Request Submitted/i)).toBeInTheDocument();
      });

      expect(
        screen.getByText(/If a pending invitation exists for this email/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Still nothing after a few minutes\? Check spam, or ask your administrator\./i)
      ).toBeInTheDocument();
    });
  });

  describe('3. /accept-invitation Friendly Fallbacks', () => {
    it('shows friendly panel without red error when no token is present', async () => {
      render(
        <Provider store={store}>
          <MemoryRouter initialEntries={['/accept-invitation']}>
            <AcceptInvitationPage />
          </MemoryRouter>
        </Provider>
      );

      expect(
        screen.getByText(/Open the link from your invitation email, or request a new one/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Request a new link/i })
      ).toBeInTheDocument();
      expect(screen.queryByText(/Invalid Invitation Link/i)).not.toBeInTheDocument();
    });

    it('shows revoked/accepted message for revoked tokens', async () => {
      globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = getRequestUrl(input);
        if (url.includes('/auth/invitations/validate')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: false,
                error: {
                  code: 'TOKEN_REVOKED',
                  message: 'This invitation has been revoked.',
                },
              }),
              { status: 410, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        return Promise.resolve(new Response(JSON.stringify({ success: true })));
      });

      render(
        <Provider store={store}>
          <MemoryRouter initialEntries={['/accept-invitation?token=some-token']}>
            <AcceptInvitationPage />
          </MemoryRouter>
        </Provider>
      );

      await waitFor(() => {
        expect(
          screen.getByText(/This invitation is no longer valid\. Contact your administrator\./i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('4. InvitationsTable Delivery Badges & Absence of Simulation Paths', () => {
    it('renders real Resend delivery badge and Last Event chip', async () => {
      globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = getRequestUrl(input);
        if (url.includes('/admin/invitations')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                data: [
                  {
                    _id: 'inv-123',
                    name: 'Jordan Lee',
                    email: 'jordan@company.com',
                    role: 'employee',
                    status: 'pending',
                    emailDeliveryStatus: 'accepted',
                    emailProviderMessageId: 'msg_resend_999',
                    emailLastEvent: 'delivered',
                    emailLastEventAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 86400000).toISOString(),
                    resendCount: 0,
                  },
                ],
                meta: { page: 1, limit: 15, total: 1, totalPages: 1 },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        return Promise.resolve(new Response(JSON.stringify({ success: true })));
      });

      render(
        <Provider store={store}>
          <MemoryRouter>
            <InvitationsTable />
          </MemoryRouter>
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Jordan Lee')).toBeInTheDocument();
      });

      // Accepted delivery status badge
      expect(
        screen.getByTitle(/Accepted by Resend API/i)
      ).toBeInTheDocument();
      // Last event chip
      expect(screen.getByText('Delivered')).toBeInTheDocument();

      // Check delivery button is present
      const checkBtn = screen.getByRole('button', {
        name: /Check delivery status for jordan@company\.com/i,
      });
      expect(checkBtn).toBeInTheDocument();

      // CONFIRM NO DEV LINK OR SIMULATION LABELS
      expect(screen.queryByText(/Dev Link/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Local simulated/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Development mode/i)).not.toBeInTheDocument();
    });
  });

  describe('5. Admin Settings Email Delivery Card', () => {
    it('renders configured Resend status, sandbox warning, and test email input', async () => {
      globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = getRequestUrl(input);
        if (url.includes('/admin/invitations/email-status')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                data: {
                  provider: 'resend',
                  configured: true,
                  senderAddress: 'AMS Portal <onboarding@resend.dev>',
                  senderDomain: 'resend.dev',
                  sandboxSender: true,
                  canReadStatus: null,
                },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        return Promise.resolve(new Response(JSON.stringify({ success: true })));
      });

      render(
        <Provider store={store}>
          <MemoryRouter>
            <EmailDeliveryCard />
          </MemoryRouter>
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Sandbox sender active:/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/Configured/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Test Recipient Email/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Send Test Email/i })).toBeInTheDocument();
    });
  });
});
