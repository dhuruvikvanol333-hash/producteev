import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ success: true, data: notifications });
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  
  const result = await prisma.notification.updateMany({
    where: { id: id as string, userId },
    data: { isRead: true },
  });
  
  if (result.count === 0) {
    res.status(404).json({ success: false, error: 'Notification not found' });
    return;
  }
  
  try {
    const { getIO } = require('../socket');
    getIO().to(`user:${userId}`).emit('notification:read_sync', { id });
  } catch (e) { }
  
  res.json({ success: true });
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  
  try {
    const { getIO } = require('../socket');
    getIO().to(`user:${userId}`).emit('notification:read_all_sync');
  } catch (e) { }
  
  res.json({ success: true });
});

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const count = await prisma.notification.count({
    where: { userId: req.user!.id, isRead: false },
  });
  res.json({ success: true, data: { count } });
});
