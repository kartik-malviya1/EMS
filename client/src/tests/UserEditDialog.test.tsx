import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { UserEditDialog } from '../components/users/UserEditDialog';
import { apiSlice } from '../features/api/apiSlice';
import authReducer from '../features/auth/authSlice';
import type { User } from '../types/models';

const createTestStore = () =>
  configureStore({
    reducer: {
      [apiSlice.reducerPath]: apiSlice.reducer,
      auth: authReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(apiSlice.middleware),
  });

const mockUser: User = {
  id: 'usr-456',
  name: 'Sarah Connor',
  email: 'sarah@example.com',
  role: 'manager',
  isActive: true,
};

describe('UserEditDialog Component', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it('renders user details and handles role changes', async () => {
    render(
      <Provider store={store}>
        <UserEditDialog
          user={mockUser}
          open={true}
          onOpenChange={vi.fn()}
        />
      </Provider>
    );

    expect(screen.getByText(/Edit User/i)).toBeInTheDocument();
    expect(screen.getByText(/sarah@example.com/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sarah Connor')).toBeInTheDocument();

    const roleSelect = screen.getByLabelText(/System Role/i);
    expect(roleSelect).toHaveValue('manager');

    await userEvent.selectOptions(roleSelect, 'employee');
    expect(roleSelect).toHaveValue('employee');
  });

  it('maps HAS_TEAM_MEMBERS server error to descriptive message', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : input.toString();

      if (url.includes('/managers')) {
        return Promise.resolve(
          new Response(JSON.stringify({ success: true, data: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }

      if (url.includes('/users/usr-456')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: false,
              error: {
                code: 'HAS_TEAM_MEMBERS',
                message: 'Cannot demote manager with team members',
              },
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    globalThis.fetch = fetchMock;

    render(
      <Provider store={store}>
        <UserEditDialog
          user={mockUser}
          open={true}
          onOpenChange={vi.fn()}
        />
      </Provider>
    );

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    await userEvent.click(saveBtn);

    expect(
      await screen.findByText(/Cannot demote or deactivate this manager because they have assigned team members/i)
    ).toBeInTheDocument();
  });
});
