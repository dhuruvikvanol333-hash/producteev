import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { OrgRole } from '@prisma/client';
import { NotificationService } from './notification.service';
import { stripHtml } from '../utils/string';

export class CommentService {
  static async create(taskId: string, userId: string, text: string, role: OrgRole, fileData?: { imageUrl?: string | null; fileUrl?: string | null; fileName?: string | null; fileType?: string | null; fileSize?: number | null }) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw ApiError.notFound('Task not found');

    const comment = await prisma.comment.create({
      data: { taskId, userId, text, ...fileData },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    // Notify activity - Strip HTML from notification message
    const cleanText = stripHtml(text);
    await NotificationService.notifyTaskActivity(
      taskId,
      userId,
      role,
      task.title,
      `${comment.user.firstName} commented: "${cleanText.substring(0, 50)}${cleanText.length > 50 ? '...' : ''}"`
    );

    return comment;
  }

  static async getByTask(taskId: string) {
    return prisma.comment.findMany({
      where: { taskId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async delete(id: string, userId: string) {
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) throw ApiError.notFound('Comment not found');
    if (comment.userId !== userId) throw ApiError.forbidden('Not your comment');
    await prisma.comment.delete({ where: { id } });
  }
}
