import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { MessageService } from '../services/message.service';
import { NotificationService } from '../services/notification.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { getIO } from '../socket';

const sendSchema = z.object({
  receiverId: z.string().uuid(),
  text: z.string().optional(),
  imageUrl: z.string().optional(),
});

export class MessageController {
  getConversation = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const userId = String(req.params.userId);
    const before = req.query.before ? String(req.query.before) : undefined;
    const messages = await MessageService.getConversation(req.user.id, userId, 50, before);
    res.json({ success: true, data: messages });
  });

  sendMessage = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { receiverId, text, imageUrl } = sendSchema.parse(req.body);
    if (!text && !imageUrl) throw ApiError.badRequest('Message must have text or image');
    
    // Fetch sender info for notification
    const sender = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { firstName: true }
    });

    const message = await MessageService.sendMessage(req.user.id, receiverId, text, imageUrl);

    // 1. Notify receiver about new DM (Inbox Notice)
    try {
      await NotificationService.create(
        receiverId,
        `New Message`,
        `${sender?.firstName || 'Someone'}: ${text || 'Sent an image'}`,
        `/tasks/team?userId=${req.user.id}`
      );
    } catch (err) {
      console.warn('Failed to send DM notification:', err);
    }

    // 2. Emit real-time message to receiver via socket for Chat component
    try {
      const io = getIO();
      io.to(`user:${receiverId}`).emit('message:new', message);
    } catch {
      // Socket not initialized
    }

    res.json({ success: true, data: message });
  });

  getRecentChats = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const chats = await MessageService.getRecentChats(req.user.id);
    res.json({ success: true, data: chats });
  });

  getUnreadCounts = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const counts = await MessageService.getUnreadCounts(req.user.id);
    res.json({ success: true, data: counts });
  });

  markAsRead = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const senderId = String(req.params.senderId);
    await MessageService.markAsRead(req.user.id, senderId);

    // Notify sender that their messages were read
    try {
      const io = getIO();
      io.to(`user:${senderId}`).emit('messages:read-receipt', { readBy: req.user.id });
    } catch {
      // Socket not initialized
    }

    res.json({ success: true });
  });
}
