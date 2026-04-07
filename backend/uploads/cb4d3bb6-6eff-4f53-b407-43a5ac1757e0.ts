import { Request, Response } from 'express';
import { z } from 'zod';
import { CommentService } from '../services/comment.service';
import { TaskService } from '../services/task.service';
import { ActivityService } from '../services/activity.service';
import { NotificationService } from '../services/notification.service';
import { UserService } from '../services/user.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { prisma } from '../config/database';

const createSchema = z.object({
  text: z.string().min(1),
});

export class CommentController {
  /** POST /tasks/:taskId/comments */
  create = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const taskId = req.params.taskId as string;
    const { text } = createSchema.parse(req.body);

    const task = await TaskService.getById(taskId);
    // @ts-ignore - Assuming verifyTaskAccess is accessible or use TaskService logic
    // Resolve organizationId from task
    const organizationId = task.project?.organizationId || ((task as any).list?.space?.organizationId);

    if (!organizationId) throw ApiError.badRequest('Unable to resolve organization for task');

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: req.user.id
        }
      }
    });

    if (!membership) throw ApiError.forbidden('Not a member of this organization');
    if (membership.role === 'GUEST') throw ApiError.forbidden('Guests cannot add comments');

    const comment = await CommentService.create(taskId, req.user.id, text);

    await ActivityService.log({
      userId: req.user.id,
      entityType: 'task',
      entityId: taskId,
      action: 'comment.created',
      changes: { commentId: comment.id, text },
    });

    const currentUser = await UserService.getById(req.user.id);
    const userName = `${currentUser.firstName} ${currentUser.lastName}`.trim() || currentUser.email;

    if (task.assignees && task.assignees.length > 0) {
      const notificationPromises = task.assignees
        .filter(a => a.id !== req.user!.id)
        .map(a => NotificationService.create(
          a.id,
          task.title,
          `${userName} commented on this task`,
          `/tasks/${task.id}`
        ));
      await Promise.all(notificationPromises);
    }

    res.status(201).json({ success: true, data: comment });
  });

  /** GET /tasks/:taskId/comments */
  getByTask = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const taskId = req.params.taskId as string;
    const comments = await CommentService.getByTask(taskId);
    res.json({ success: true, data: comments });
  });

  /** DELETE /comments/:id */
  delete = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await CommentService.delete(req.params.id as string, req.user.id);
    res.json({ success: true, message: 'Comment deleted' });
  });
}
