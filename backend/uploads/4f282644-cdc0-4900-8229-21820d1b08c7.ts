import { useEffect, useRef } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';
import { useAppSelector } from '../store';
import type { Socket } from 'socket.io-client';

export function useSocket(): Socket | null {
  const token = useAppSelector((state) => state.auth.accessToken);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (token) {
      socketRef.current = connectSocket(token);
    }

    return () => {
      disconnectSocket();
      socketRef.current = null;
    };
  }, [token]);

  return getSocket();
}
