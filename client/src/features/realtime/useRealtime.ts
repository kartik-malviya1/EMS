import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import {
  connectSocket,
  disconnectSocket,
  subscribeSocketStatus,
  type SocketConnectionStatus,
} from './socket';

export function useRealtime(): { status: SocketConnectionStatus } {
  const { user, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<SocketConnectionStatus>('disconnected');

  useEffect(() => {
    const unsubscribe = subscribeSocketStatus(setStatus);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      connectSocket();
    } else {
      disconnectSocket();
    }

    return () => {
      // Don't disconnect on transient rerenders, but handle unmount
    };
  }, [isAuthenticated, user]);

  return { status };
}
