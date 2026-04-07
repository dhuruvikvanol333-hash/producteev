import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let activeConnections = 0;

export function connectSocket(token: string): Socket {
  activeConnections++;
  if (socket?.connected) return socket;

  if (!socket) {
    socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
  } else {
    socket.auth = { token };
    socket.connect();
  }

  return socket;
}

export function disconnectSocket(): void {
  activeConnections--;
  if (activeConnections <= 0) {
    socket?.disconnect();
    socket = null;
    activeConnections = 0;
  }
}

export function forceDisconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  activeConnections = 0;
}

export function getSocket(): Socket | null {
  return socket;
}
