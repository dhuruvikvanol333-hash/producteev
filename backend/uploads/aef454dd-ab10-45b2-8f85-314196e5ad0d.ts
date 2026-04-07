import { Request, Response } from 'express';
import { z } from 'zod';
import { TaskStatus, TaskPriority, Prisma, OrgRole } from '@prisma/client';
import { prisma } from '../config/database';
import { TaskService } from '../services/task.service';
import { ActivityService } from '../services/activity.service';
import { NotificationService } from '../services/notification.service';
import { getIO } from '../socket';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueDate: z.string().optional(),
  projectId: z.string().uuid().optional(),
  listId: z.string().uuid().optional(),
  isFavorite: z.boolean().optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueDate: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  assigneeIds: z.array(z.string().uuid()).nullable().optional(),
  listId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string().uuid()).nullable().optional(),
});

const bulkUpdateSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1),
  data: z.object({
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    dueDate: z.string().nullable().optional(),
    isFavorite: z.boolean().optional(),
    assigneeIds: z.array(z.string().uuid()).nullable().optional(),
    tagIds: z.array(z.string().uuid()).nullable().optional(),
  }),
});

const bulkDeleteSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1),
});

export class TaskController {
  private async verifyTaskAccess(task: any, userId: string, requiredRole?: OrgRole) {
    let organizationId: string | undefined;

    if (task.projectId && (task.project || (task.projectId && !task.listId))) {
      const proj = task.project || await prisma.project.findUnique({ where: { id: task.projectId }, select: { organizationId: true } });
      organizationId = proj?.organizationId;
    } else if (task.listId) {
      const list = task.list || await prisma.list.findUnique({ 
        where: { id: task.listId }, 
        include: { space: { select: { organizationId: true } } } 
      });
      organizationId = list?.space?.organizationId || list?.space.organizationId;
    }

    if (!organizationId) {
      throw ApiError.forbidden('Task is not associated with any organization');
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: userId,
        },
      },
    });

    if (!membership) throw ApiError.forbidden('Not a member of this organization');

    if (requiredRole) {
      const roleWeights: Record<OrgRole, number> = { 'OWNER': 4, 'ADMIN': 3, 'MEMBER': 2, 'LIMITED_MEMBER': 1, 'GUEST': 0 };
      if (roleWeights[membership.role] < roleWeights[requiredRole]) {
         throw ApiError.forbidden(`Required role: ${requiredRole}`);
      }
    }
    return membership;
  }

  create = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = createSchema.parse(req.body);

    // Verify access to Target List/Project (Prioritize List in the new hierarchy)
    let organizationId: string | undefined;

    if (data.listId && data.listId.trim() !== '') {
      const list = await prisma.list.findUnique({ 
        where: { id: data.listId }, 
        include: { space: { select: { organizationId: true } } } 
      });
      organizationId = list?.space.organizationId;
    }

    if (!organizationId && data.projectId && data.projectId.trim() !== '') {
      const proj = await prisma.project.findUnique({ 
        where: { id: data.projectId }, 
        select: { organizationId: true } 
      });
      organizationId = proj?.organizationId;
    }

    if (!organizationId) {
      throw ApiError.badRequest('Could not resolve organization from provided listId or projectId');
    }
    
    const membership = await prisma.organizationMember.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId, userId: req.user.id } },
    });

    if (membership.role === 'GUEST' || membership.role === 'LIMITED_MEMBER') {
      throw ApiError.forbidden('You do not have permission to create tasks');
    }

    const task = await TaskService.create({
      ...data,
      createdById: req.user.id,
    }) as any;

    await ActivityService.log({
      userId: req.user.id,
      entityType: 'task',
      entityId: task.id,
      action: 'task.created',
      changes: { title: task.title },
    });

    try { getIO().emit('task:refresh'); } catch (e) { }

    if (task.assignees && task.assignees.length > 0) {
      const otherAssignees = task.assignees.filter((a: any) => a.id !== req.user?.id);
      for (const assignee of otherAssignees) {
        await NotificationService.create(
          assignee.id,
          'Task Assigned',
          `You have been assigned to a new task: ${task.title}`,
          `/tasks/${task.id}`
        );
      }
    }

    res.status(201).json({ success: true, data: task });
  });

  getByProject = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { projectId } = req.params;
    const { status, priority, assigneeIds } = req.query;

    const project = await prisma.project.findUnique({
      where: { id: projectId as string },
      select: { organizationId: true },
    });
    if (!project) throw ApiError.notFound('Project not found');

    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: project.organizationId, userId: req.user.id } },
    });
    if (!membership) throw ApiError.forbidden('Not a member of this organization');

    const tasks = await TaskService.getByProject(
      {
        projectId: projectId as string,
        status: status as TaskStatus | undefined,
        priority: priority as TaskPriority | undefined,
        assigneeIds: typeof assigneeIds === 'string' ? [assigneeIds] : assigneeIds as string[] | undefined,
      },
      req.user.id,
      membership.role
    );
    res.json({ success: true, data: tasks });
  });

  getByList = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { listId } = req.params;
    const { status, priority, assigneeIds } = req.query;

    const list = await prisma.list.findUnique({
      where: { id: listId as string },
      include: { space: { select: { organizationId: true } } },
    });
    if (!list) throw ApiError.notFound('List not found');

    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: list.space.organizationId, userId: req.user.id } },
    });
    if (!membership) throw ApiError.forbidden('Not a member of this organization');

    const tasks = await TaskService.getByProject(
      {
        listId: listId as string,
        status: status as TaskStatus | undefined,
        priority: priority as TaskPriority | undefined,
        assigneeIds: typeof assigneeIds === 'string' ? [assigneeIds] : assigneeIds as string[] | undefined,
      },
      req.user.id,
      membership.role
    );
    res.json({ success: true, data: tasks });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const task = await TaskService.getById(req.params.id as string);
    const membership = await this.verifyTaskAccess(task, req.user.id);
    
    // RBAC logic for Member visibility - Members can see all in the organization/list
    if (membership.role === 'LIMITED_MEMBER') {
      const isAssignee = task.assignees.some((a: any) => a.id === req.user?.id);
      if (!isAssignee) throw ApiError.forbidden('You are not assigned to this task');
    }
    // GUEST is allowed to view (read-only)
    
    res.json({ success: true, data: task });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = updateSchema.parse(req.body);

    // Get current task state and verify access
    const before = await TaskService.getById(req.params.id as string);
    const membership = await this.verifyTaskAccess(before, req.user.id);

    if (membership.role === 'GUEST') {
      throw ApiError.forbidden('Guests cannot update tasks');
    }

    const task = await TaskService.update(req.params.id as string, data, membership.role);

    // Determine specific action and build changes object
    const changes: Record<string, unknown> = {};
    let action = 'task.updated';

    if (data.status !== undefined && data.status !== before.status) {
      action = 'task.status_changed';
      changes.status = { from: before.status, to: data.status };
    }
    if (data.assigneeIds !== undefined) {
      action = 'task.assigned';
      const beforeNames = (before.assignees || []).map((a: any) => `${a.firstName} ${a.lastName}`).join(', ');
      const afterNames = (task.assignees || []).map((a: any) => `${a.firstName} ${a.lastName}`).join(', ');

      changes.assignees = {
        from: beforeNames || 'None',
        to: afterNames || 'None',
      };

      // Notify newly added assignees
      const beforeIds = new Set((before.assignees || []).map((a: any) => a.id));
      const newAssignees = (task.assignees || []).filter((a: any) => !beforeIds.has(a.id) && a.id !== req.user?.id);

      for (const assignee of newAssignees) {
        await NotificationService.create(
          assignee.id,
          'Task Assigned',
          `You have been assigned to task: ${task.title}`,
          `/tasks/${task.id}`
        );
      }
    }
    if (data.title !== undefined && data.title !== before.title) {
      changes.title = { from: before.title, to: data.title };
    }
    if (data.description !== undefined && data.description !== before.description) {
      changes.description = { from: 'previous', to: 'updated' };
    }
    if (data.priority !== undefined && data.priority !== before.priority) {
      changes.priority = { from: before.priority, to: data.priority };
    }
    if (data.dueDate !== undefined) {
      const oldDate = before.dueDate ? new Date(before.dueDate).toISOString().split('T')[0] : null;
      const newDate = data.dueDate ? new Date(data.dueDate).toISOString().split('T')[0] : null;
      if (oldDate !== newDate) {
        changes.dueDate = { from: oldDate, to: newDate };
      }
    }

    await ActivityService.log({
      userId: req.user.id,
      entityType: 'task',
      entityId: task.id,
      action,
      changes: changes as Prisma.InputJsonValue,
    });

    try { getIO().emit('task:refresh'); } catch (e) { }

    res.json({ success: true, data: task });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const task = await TaskService.getById(req.params.id as string);
    const membership = await this.verifyTaskAccess(task, req.user.id, 'ADMIN');

    await ActivityService.log({
      userId: req.user.id,
      entityType: 'task',
      entityId: task.id,
      action: 'task.deleted',
      changes: { title: task.title },
    });

    await TaskService.delete(req.params.id as string, membership.role);
    try { getIO().emit('task:refresh'); } catch (e) { }
    res.json({ success: true, message: 'Task deleted' });
  });

  bulkUpdate = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { taskIds, data } = bulkUpdateSchema.parse(req.body);
    
    if (taskIds.length > 0) {
      const firstTask = await TaskService.getById(taskIds[0]);
      const membership = await this.verifyTaskAccess(firstTask, req.user.id);
      
      if (membership.role === 'GUEST' || membership.role === 'LIMITED_MEMBER' || membership.role === 'MEMBER') {
        const allowedFields = ['status', 'isFavorite'];
        const attemptedFields = Object.keys(data);
        const isForbiddenUpdate = attemptedFields.some(f => !allowedFields.includes(f));
        if (isForbiddenUpdate) throw ApiError.forbidden('Only status updates allowed for this role');
      }
    }

    const result = await TaskService.bulkUpdate(taskIds, data);

    await ActivityService.log({
      userId: req.user.id,
      entityType: 'task',
      entityId: taskIds[0],
      action: 'task.bulk_updated',
      changes: { count: result.updated, taskIds },
    });

    try { getIO().emit('task:refresh'); } catch (e) { }
    res.json({ success: true, data: result });
  });

  bulkDelete = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { taskIds } = bulkDeleteSchema.parse(req.body);

    if (taskIds.length > 0) {
      const firstTask = await TaskService.getById(taskIds[0]);
      await this.verifyTaskAccess(firstTask, req.user.id, 'ADMIN');
    }

    await ActivityService.log({
      userId: req.user.id,
      entityType: 'task',
      entityId: taskIds[0],
      action: 'task.bulk_deleted',
      changes: { count: taskIds.length, taskIds },
    });

    const result = await TaskService.bulkDelete(taskIds);
    try { getIO().emit('task:refresh'); } catch (e) { }
    res.json({ success: true, data: result });
  });

  getMyTasks = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const tasks = await TaskService.getAssignedToUser(req.user.id);
    res.json({ success: true, data: tasks });
  });

  getAllTasks = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();

    const memberships = await prisma.organizationMember.findMany({
      where: { userId: req.user.id },
      select: { role: true },
    });

    const roles = memberships.map(m => m.role);
    let highestRole: OrgRole = 'GUEST';
    if (roles.includes('OWNER')) highestRole = 'OWNER';
    else if (roles.includes('ADMIN')) highestRole = 'ADMIN';
    else if (roles.includes('MEMBER')) highestRole = 'MEMBER';
    else if (roles.includes('LIMITED_MEMBER')) highestRole = 'LIMITED_MEMBER';

    const tasks = await TaskService.getAllTasks(req.user.id, highestRole);
    res.json({ success: true, data: tasks });
  });

  getFavorites = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();

    const memberships = await prisma.organizationMember.findMany({
      where: { userId: req.user.id },
      select: { role: true },
    });

    const roles = memberships.map(m => m.role);
    let highestRole: OrgRole = 'GUEST';
    if (roles.includes('OWNER')) highestRole = 'OWNER';
    else if (roles.includes('ADMIN')) highestRole = 'ADMIN';
    else if (roles.includes('MEMBER')) highestRole = 'MEMBER';
    else if (roles.includes('LIMITED_MEMBER')) highestRole = 'LIMITED_MEMBER';

    const tasks = await TaskService.getFavorites(req.user.id, highestRole);
    res.json({ success: true, data: tasks });
  });
}
