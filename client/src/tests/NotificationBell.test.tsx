import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { NotificationBell } from '../components/notifications/NotificationBell';
import { apiSlice } from '../features/api/apiSlice';
import authReducer from '../features/auth/authSlice';

const createTestStore = () =>
  configureStore({
    reducer: {
      [apiSlice.reducerPath]: apiSlice.reducer,
      auth: authReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(apiSlice.middleware),
  });

describe('NotificationBell Component', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    vi.restoreAllMocks();
  });

  it('renders without badge when unreadCount is 0', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : input.toString();

      if (url.includes('/notifications/unread-count')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: { unreadCount: 0 },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      if (url.includes('/notifications')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: [],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    globalThis.fetch = fetchMock;

    render(
      <Provider store={store}>
        <BrowserRouter>
          <NotificationBell />
        </BrowserRouter>
      </Provider>
    );

    const bellBtn = screen.getByRole('button', { name: /Notifications/i });
    expect(bellBtn).toBeInTheDocument();
    expect(screen.queryByTestId('unread-notification-badge')).not.toBeInTheDocument();
  });

  it('renders badge with count when unreadCount > 0', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : input.toString();

      if (url.includes('/notifications/unread-count')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: { unreadCount: 5 },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      if (url.includes('/notifications')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: [
                {
                  id: 'n-1',
                  title: 'Shift Verified',
                  message: 'Your shift on 2026-10-10 has been approved.',
                  type: 'shift_verified',
                  createdAt: new Date().toISOString(),
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    globalThis.fetch = fetchMock;

    render(
      <Provider store={store}>
        <BrowserRouter>
          <NotificationBell />
        </BrowserRouter>
      </Provider>
    );

    await waitFor(() => {
      const badge = screen.getByTestId('unread-notification-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('5');
    });
  });

  it('opens dropdown and displays notification list', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : input.toString();

      if (url.includes('/notifications/unread-count')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: { unreadCount: 1 },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      if (url.includes('/notifications')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: [
                {
                  id: 'n-1',
                  title: 'Audit Warning',
                  message: 'Punch location was outside designated perimeter.',
                  type: 'geofence_violation',
                  createdAt: new Date().toISOString(),
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    globalThis.fetch = fetchMock;

    render(
      <Provider store={store}>
        <BrowserRouter>
          <NotificationBell />
        </BrowserRouter>
      </Provider>
    );

    const bellBtn = screen.getByRole('button', { name: /Notifications/i });
    await userEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText(/Audit Warning/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Punch location was outside designated perimeter/i)
      ).toBeInTheDocument();
    });
  });
});
