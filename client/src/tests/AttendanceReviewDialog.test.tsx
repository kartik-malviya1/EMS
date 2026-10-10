import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { AttendanceReviewDialog } from '../components/review/AttendanceReviewDialog';
import { apiSlice } from '../features/api/apiSlice';
import authReducer from '../features/auth/authSlice';
import type { Attendance } from '../types/models';

const createTestStore = () =>
  configureStore({
    reducer: {
      [apiSlice.reducerPath]: apiSlice.reducer,
      auth: authReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(apiSlice.middleware),
  });

const mockAttendance: Attendance = {
  id: 'att-12345',
  employeeId: {
    id: 'emp-1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'employee',
    isActive: true,
  },
  workDate: '2026-10-10',
  punchIn: {
    at: new Date('2026-10-10T09:00:00Z').toISOString(),
    location: {
      latitude: 28.6139,
      longitude: 77.209,
      accuracy: 15,
      distanceFromOfficeMeters: 45,
      withinGeofence: true,
    },
  },
  punchOut: {
    at: new Date('2026-10-10T17:30:00Z').toISOString(),
    location: {
      latitude: 28.6139,
      longitude: 77.209,
      accuracy: 20,
      distanceFromOfficeMeters: 50,
      withinGeofence: true,
    },
  },
  workedMinutes: 510,
  workingStatus: 'completed',
  verification: {
    status: 'pending',
    history: [],
  },
  overtime: {
    status: 'not_requested',
  },
};

describe('AttendanceReviewDialog Component', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it('renders employee info, geolocation data, and map links', () => {
    render(
      <Provider store={store}>
        <AttendanceReviewDialog
          attendance={mockAttendance}
          open={true}
          onOpenChange={vi.fn()}
        />
      </Provider>
    );

    expect(screen.getByText(/Verification Review: John Doe/i)).toBeInTheDocument();
    expect(screen.getByText(/john@example.com/i)).toBeInTheDocument();
    expect(screen.getByText(/45 m/i)).toBeInTheDocument();
    const mapLinks = screen.getAllByRole('link', { name: /Open Location in Maps/i });
    expect(mapLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('disables "Mark as Invalid" when remarks are less than 5 characters', async () => {
    render(
      <Provider store={store}>
        <AttendanceReviewDialog
          attendance={mockAttendance}
          open={true}
          onOpenChange={vi.fn()}
        />
      </Provider>
    );

    const invalidBtn = screen.getByRole('button', { name: /Mark as Invalid/i });
    expect(invalidBtn).toBeDisabled();

    const textarea = screen.getByPlaceholderText(/Provide context or explanation/i);
    await userEvent.type(textarea, 'Bad');
    expect(invalidBtn).toBeDisabled();

    await userEvent.type(textarea, ' image mismatch');
    expect(invalidBtn).not.toBeDisabled();
  });

  it('allows clicking "Mark as Valid" without requiring remarks', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/verification')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: {
                ...mockAttendance,
                verification: { status: 'valid' },
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    globalThis.fetch = fetchMock;

    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <Provider store={store}>
        <AttendanceReviewDialog
          attendance={mockAttendance}
          open={true}
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
        />
      </Provider>
    );

    const validBtn = screen.getByRole('button', { name: /Mark as Valid/i });
    expect(validBtn).not.toBeDisabled();
    await userEvent.click(validBtn);

    expect(fetchMock).toHaveBeenCalled();
  });
});
