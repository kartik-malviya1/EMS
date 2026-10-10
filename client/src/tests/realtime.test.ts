import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSocketStatus,
  subscribeSocketStatus,
  disconnectSocket,
  fetchSocketToken,
} from '../features/realtime/socket';

describe('Realtime Socket Service', () => {
  beforeEach(() => {
    disconnectSocket();
    vi.restoreAllMocks();
  });

  it('provides socket status subscription and starts disconnected', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSocketStatus(listener);

    expect(listener).toHaveBeenCalledWith('disconnected');
    expect(getSocketStatus()).toBe('disconnected');

    unsubscribe();
  });

  it('fetches socket token from /api/auth/socket-token endpoint', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : input.toString();

      if (url.includes('/api/auth/socket-token')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: { socketToken: 'test-jwt-socket-token', expiresIn: 60 },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    globalThis.fetch = fetchMock;

    const token = await fetchSocketToken();
    expect(token).toBe('test-jwt-socket-token');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('returns null when socket token request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    globalThis.fetch = fetchMock;

    const token = await fetchSocketToken();
    expect(token).toBeNull();
  });
});
