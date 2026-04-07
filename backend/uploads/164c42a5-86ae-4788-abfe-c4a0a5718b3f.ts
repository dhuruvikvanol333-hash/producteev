import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { NotificationService } from './notification.service';

export class CommentService {
  static async create(taskId: string, userId: string, text: string) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw ApiError.notFound('Task not found');

    const comment = await prisma.comment.create({
      data: { taskId, userId, text },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    // Notify activity
    await NotificationService.notifyTaskActivity(
      taskId,
      userId,
      'New Comment',
      `${comment.user.firstName} commented on the task: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`
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
