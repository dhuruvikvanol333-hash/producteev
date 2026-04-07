import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { config } from '../config';
import { registerNotificationHandlers } from './handlers/notification.handler';
import { verifyAccessToken } from '../utils/jwt';

let io: Server;

// Track online users: userId -> Set of socketIds
const onlineUsers = new Map<string, Set<string>>();

// Track which users are currently screen-sharing
const screenSharers = new Set<string>();

export function initializeSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: config.CORS_ORIGIN,
      methods: ['GET', 'POST'],
    },
  });

  // Authenticate socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = verifyAccessToken(token);
      socket.data.userId = decoded.userId;
      socket.data.email = decoded.email;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId: string = socket.data.userId;
    console.log(`Client connected: ${socket.id} (user: ${userId})`);

    // Join personal room for direct messages
    socket.join(`user:${userId}`);

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    // Broadcast that this user is now online
    io.emit('user:online', { userId });

    // Send current online users list to the newly connected user
    const onlineUserIds = Array.from(onlineUsers.keys());
    socket.emit('users:online-list', onlineUserIds);

    socket.on('join-organization', (orgId: string) => {
      socket.join(`org:${orgId}`);
    });

    socket.on('leave-organization', (orgId: string) => {
      socket.leave(`org:${orgId}`);
    });

    // Admin room: admins join this room to receive all screen-share events
    socket.on('admin:join-monitor', () => {
      socket.join('admin:monitor');
      // Send current list of screen-sharers
      socket.emit('admin:screen-sharers', Array.from(screenSharers));
    });

    socket.on('admin:leave-monitor', () => {
      socket.leave('admin:monitor');
    });

    // Notify admin monitor room when a user starts screen sharing
    socket.on('screen:start', () => {
      screenSharers.add(userId);
      io.to('admin:monitor').emit('admin:screen-start', { userId });
    });

    // Notify admin monitor room when a user stops screen sharing
    socket.on('screen:stop', () => {
      screenSharers.delete(userId);
      io.to('admin:monitor').emit('admin:screen-stop', { userId });
    });

    // Admin requests a screen from a specific user (WebRTC offer via admin room)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on('admin:request-screen', (data: { targetUserId: string; offer: any }) => {
      io.to(`user:${data.targetUserId}`).emit('admin:screen-request', {
        adminSocketId: socket.id,
        offer: data.offer,
      });
    });

    // User answers admin screen-request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on('admin:screen-answer', (data: { adminSocketId: string; answer: any }) => {
      io.to(data.adminSocketId).emit('admin:screen-answer', {
        fromUserId: userId,
        answer: data.answer,
      });
    });

    // ICE candidates for admin-screen sessions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on('admin:ice-candidate', (data: { targetId: string; candidate: any }) => {
      io.to(data.targetId).emit('admin:ice-candidate', {
        fromUserId: userId,
        fromId: socket.id,
        candidate: data.candidate,
      });
    });

    // Mark messages as read
    socket.on('messages:read', (data: { senderId: string }) => {
      // Notify the sender that their messages were read
      io.to(`user:${data.senderId}`).emit('messages:read-receipt', {
        readBy: userId,
      });
    });

    // WebRTC signaling for screen share
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on('webrtc:offer', (data: { targetUserId: string; offer: any }) => {
      io.to(`user:${data.targetUserId}`).emit('webrtc:offer', {
        fromUserId: userId,
        offer: data.offer,
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on('webrtc:answer', (data: { targetUserId: string; answer: any }) => {
      io.to(`user:${data.targetUserId}`).emit('webrtc:answer', {
        fromUserId: userId,
        answer: data.answer,
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on('webrtc:ice-candidate', (data: { targetUserId: string; candidate: any }) => {
      io.to(`user:${data.targetUserId}`).emit('webrtc:ice-candidate', {
        fromUserId: userId,
        candidate: data.candidate,
      });
    });

    socket.on('webrtc:stop-share', (data: { targetUserId: string }) => {
      io.to(`user:${data.targetUserId}`).emit('webrtc:stop-share', {
        fromUserId: userId,
      });
    });

    // --- VIDEO CALL SIGNALING ---
    socket.on('video:call:initiate', (data: { targetUserId: string; callerName: string }) => {
      io.to(`user:${data.targetUserId}`).emit('video:call:incoming', {
        fromUserId: userId,
        callerName: data.callerName
      });
    });

    socket.on('video:call:accept', (data: { targetUserId: string }) => {
      io.to(`user:${data.targetUserId}`).emit('video:call:accepted', {
        fromUserId: userId
      });
    });

    socket.on('video:call:reject', (data: { targetUserId: string }) => {
      io.to(`user:${data.targetUserId}`).emit('video:call:rejected', {
        fromUserId: userId
      });
    });

    registerNotificationHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id} (user: ${userId})`);

      // Remove from online tracking
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          // Broadcast that this user is now offline
          io.emit('user:offline', { userId });
        }
      }

      // Remove from screen sharers
      if (screenSharers.delete(userId)) {
        io.to('admin:monitor').emit('admin:screen-stop', { userId });
      }
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}

export function getOnlineUserIds(): string[] {
  return Array.from(onlineUsers.keys());
}
