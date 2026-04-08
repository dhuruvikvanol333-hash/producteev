import { Request, Response } from 'express';
import { z } from 'zod';
import { CommentService } from '../services/comment.service';
import { TaskService } from '../services/task.service';
import { ActivityService } from '../services/activity.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { prisma } from '../config/database';

const createSchema = z.object({
  text: z.string().optional().default(''),
  imageUrl: z.string().optional().nullable(),
  fileUrl: z.string().optional().nullable(),
  fileName: z.string().optional().nullable(),
  fileType: z.string().optional().nullable(),
  fileSize: z.number().optional().nullable(),
});

export class CommentController {
  /** POST /tasks/:taskId/comments */
  create = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const taskId = req.params.taskId as string;
    const { text, imageUrl, fileUrl, fileName, fileType, fileSize } = createSchema.parse(req.body);

    const task = await TaskService.getById(taskId, req.user.id);
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

    const fileData = { imageUrl, fileUrl, fileName, fileType, fileSize };
    const comment = await CommentService.create(taskId, req.user.id, text || '', membership.role, fileData);

    await ActivityService.log({
      userId: req.user.id,
      entityType: 'task',
      entityId: taskId,
      action: 'comment.created',
      changes: { commentId: comment.id, text },
    });

    try {
      import('../socket').then(({ getIO }) => {
        getIO().emit('task:refresh');
        if (organizationId) {
          getIO().to(`org:${organizationId}`).emit('task:updated', { taskId });
        }
      });
    } catch (e) {}

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
