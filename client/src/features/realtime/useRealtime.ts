import { useEffect, useState } from 'react';
import { useAppSelector } from '../../app/hooks';
import {
  connectSocket,
  disconnectSocket,
  subscribeSocketStatus,
  type SocketConnectionStatus,
} from './socket';

export function useRealtime(): { status: SocketConnectionStatus } {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const user = useAppSelector((state) => state.auth.user);
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
