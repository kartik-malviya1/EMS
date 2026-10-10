import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { PunchCard } from '../components/employee/PunchCard';
import { apiSlice } from '../features/api/apiSlice';
import authReducer from '../features/auth/authSlice';
import themeReducer from '../features/theme/themeSlice';
import type { Attendance } from '../types/models';

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

describe('PunchCard Component Button States', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  const baseRecord: Attendance = {
    id: 'att-123',
    employeeId: 'emp-1',
    workDate: '2026-10-10',
    punchIn: {
      at: '2026-10-10T09:00:00.000Z',
      location: { latitude: 12.9716, longitude: 77.5946, accuracy: 15 },
    },
    punchOut: null,
    workedMinutes: null,
    workingStatus: 'in_progress',
    verification: { status: 'pending' },
    overtime: { status: 'not_requested' },
  };

  it('enables Punch In and disables Punch Out when user is not punched in', () => {
    render(
      <Provider store={store}>
        <PunchCard todayAttendance={null} />
      </Provider>
    );

    const punchInBtn = screen.getByTestId('punch-in-button');
    const punchOutBtn = screen.getByTestId('punch-out-button');

    expect(punchInBtn).toBeEnabled();
    expect(punchOutBtn).toBeDisabled();
  });

  it('disables Punch In and enables Punch Out when shift is in_progress', () => {
    const inProgressRecord: Attendance = {
      ...baseRecord,
      workingStatus: 'in_progress',
    };

    render(
      <Provider store={store}>
        <PunchCard todayAttendance={inProgressRecord} />
      </Provider>
    );

    const punchInBtn = screen.getByTestId('punch-in-button');
    const punchOutBtn = screen.getByTestId('punch-out-button');

    expect(punchInBtn).toBeDisabled();
    expect(punchOutBtn).toBeEnabled();
  });

  it('disables both Punch In and Punch Out when shift is completed', () => {
    const completedRecord: Attendance = {
      ...baseRecord,
      workingStatus: 'completed',
      punchOut: {
        at: '2026-10-10T17:30:00.000Z',
        location: { latitude: 12.9716, longitude: 77.5946, accuracy: 12 },
      },
      workedMinutes: 510,
    };

    render(
      <Provider store={store}>
        <PunchCard todayAttendance={completedRecord} />
      </Provider>
    );

    const punchInBtn = screen.getByTestId('punch-in-button');
    const punchOutBtn = screen.getByTestId('punch-out-button');

    expect(punchInBtn).toBeDisabled();
    expect(punchOutBtn).toBeDisabled();
  });

  it('disables both Punch In and Punch Out when shift is incomplete', () => {
    const incompleteRecord: Attendance = {
      ...baseRecord,
      workingStatus: 'incomplete',
      punchOut: {
        at: '2026-10-10T14:00:00.000Z',
        location: { latitude: 12.9716, longitude: 77.5946, accuracy: 14 },
      },
      workedMinutes: 300,
    };

    render(
      <Provider store={store}>
        <PunchCard todayAttendance={incompleteRecord} />
      </Provider>
    );

    const punchInBtn = screen.getByTestId('punch-in-button');
    const punchOutBtn = screen.getByTestId('punch-out-button');

    expect(punchInBtn).toBeDisabled();
    expect(punchOutBtn).toBeDisabled();
  });

  it('disables both Punch In and Punch Out when shift is missed (auto-closed)', () => {
    const missedRecord: Attendance = {
      ...baseRecord,
      workingStatus: 'missed',
      closedBy: 'system',
      workedMinutes: 0,
    };

    render(
      <Provider store={store}>
        <PunchCard todayAttendance={missedRecord} />
      </Provider>
    );

    const punchInBtn = screen.getByTestId('punch-in-button');
    const punchOutBtn = screen.getByTestId('punch-out-button');

    expect(punchInBtn).toBeDisabled();
    expect(punchOutBtn).toBeDisabled();
  });
});
