import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeolocation } from '../hooks/useGeolocation';

describe('useGeolocation Hook', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'isSecureContext', {
      writable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('successfully returns location coordinates with high accuracy', async () => {
    const mockPosition = {
      coords: {
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 15,
      },
    };

    const getCurrentPositionMock = vi.fn((success) => {
      success(mockPosition);
    });

    Object.defineProperty(navigator, 'geolocation', {
      writable: true,
      value: {
        getCurrentPosition: getCurrentPositionMock,
      },
    });

    const { result } = renderHook(() => useGeolocation());

    let coords;
    await act(async () => {
      coords = await result.current.getLocation();
    });

    expect(coords).toEqual({
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 15,
    });
    expect(result.current.coords).toEqual({
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 15,
    });
    expect(result.current.error).toBeNull();
  });

  it('exposes permission_denied error when location is blocked by user', async () => {
    const mockError = {
      code: 1, // PERMISSION_DENIED
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
      message: 'User denied Geolocation',
    };

    const getCurrentPositionMock = vi.fn((_success, error) => {
      error(mockError);
    });

    Object.defineProperty(navigator, 'geolocation', {
      writable: true,
      value: {
        getCurrentPosition: getCurrentPositionMock,
      },
    });

    const { result } = renderHook(() => useGeolocation());

    await act(async () => {
      try {
        await result.current.getLocation();
      } catch {
        // Expected reject
      }
    });

    expect(result.current.coords).toBeNull();
    expect(result.current.error?.code).toBe('permission_denied');
    expect(result.current.error?.message).toContain('denied');
  });

  it('exposes insecure_context error when running on insecure origin', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      writable: true,
      value: false,
    });

    const { result } = renderHook(() => useGeolocation());

    await act(async () => {
      try {
        await result.current.getLocation();
      } catch {
        // Expected reject
      }
    });

    expect(result.current.error?.code).toBe('insecure_context');
  });
});
