import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { TaskStatus, TaskPriority, OrgRole, Prisma } from '@prisma/client';
import { NotificationService } from './notification.service';
import { getIO } from '../socket';

interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  isFavorite?: boolean;
  projectId?: string;
  listId?: string;
  assigneeIds?: string[];
  tagIds?: string[];
  createdById: string;
}

interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  assigneeIds?: string[] | null;
  tagIds?: string[] | null;
  listId?: string | null;
  isFavorite?: boolean;
}

interface TaskFilters {
  projectId?: string;
  listId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeIds?: string[];
}

export class TaskService {
  static async create(input: CreateTaskInput) {
    let statusId: string | undefined;

    if (input.listId) {
      const statuses = await prisma.status.findMany({
        where: { listId: input.listId },
      });

      const matchedStatus = statuses.find(s =>
        s.name.toUpperCase() === (input.status || 'OPEN') ||
        s.type === (input.status === 'CLOSED' ? 'CLOSED' : input.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'OPEN')
      );

      if (matchedStatus) {
        statusId = matchedStatus.id;
      }
    }

    const task = await prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        status: input.status,
        statusId: statusId,
        priority: input.priority,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        isFavorite: input.isFavorite || false,
        projectId: input.projectId || null,
        listId: input.listId || null,
        createdById: input.createdById,
        assignees: input.assigneeIds ? {
          connect: input.assigneeIds.map(id => ({ id }))
        } : undefined,
        tags: input.tagIds ? {
          connect: input.tagIds.map(id => ({ id }))
        } : undefined,
      },
      include: {
        assignees: {
          select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
        },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        tags: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    // Notify activity
    await NotificationService.notifyTaskActivity(
      task.id,
      input.createdById,
      'Task Created',
      `${task.createdBy.firstName} created a new task: ${task.title}`
    );

    // Emit real-time sync
    const listData = input.listId ? await prisma.list.findUnique({ where: { id: input.listId }, select: { space: { select: { organizationId: true } } } }) : null;
    const orgId = listData?.space?.organizationId;
    if (orgId) {
      try {
        getIO().to(`org:${orgId}`).emit('task:updated', { organizationId: orgId });
        getIO().to(`org:${orgId}`).emit('dashboard:refresh', { organizationId: orgId });
      } catch { }
    }

    return task;
  }

  static async getByProject(filters: TaskFilters, requestingUserId: string, role: OrgRole) {
    const where: Prisma.TaskWhereInput = {};
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.listId) where.listId = filters.listId;
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;

    if (role === 'MEMBER' || role === 'ADMIN' || role === 'OWNER' || role === 'GUEST') {
      // Members and Admins can see all. Guests can also view all.
    } else if (role === 'LIMITED_MEMBER') {
      where.assignees = { some: { id: requestingUserId } };
    } else if (filters.assigneeIds && filters.assigneeIds.length > 0) {
      where.assignees = { some: { id: { in: filters.assigneeIds } } };
    }

    return prisma.task.findMany({
      where,
      include: {
        assignees: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        tags: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  static async getById(id: string) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignees: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        project: { select: { id: true, name: true, organizationId: true } },
        tags: { select: { id: true, name: true, color: true } },
      },
    });

    if (!task) throw ApiError.notFound('Task not found');
    return task;
  }

  static async update(id: string, input: UpdateTaskInput, role: OrgRole) {
    const task = await prisma.task.findUnique({ where: { id }, include: { assignees: { select: { id: true } } } });
    if (!task) throw ApiError.notFound('Task not found');

    const { assigneeIds, tagIds, ...rest } = input;

    // RBAC: MEMBER and LIMITED_MEMBER can only update status
    if (role === 'MEMBER' || role === 'LIMITED_MEMBER') {
      const allowedFields = ['status', 'isFavorite'];
      const attemptedFields = Object.keys(input);
      const isForbiddenUpdate = attemptedFields.some(f => !allowedFields.includes(f));
      
      if (isForbiddenUpdate) {
        throw ApiError.forbidden('Members and Limited Members can only update task status');
      }
    }

    if (role === 'GUEST') {
      throw ApiError.forbidden('Guests cannot update tasks');
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        ...(rest as any),
        dueDate: input.dueDate === null ? null : input.dueDate ? new Date(input.dueDate) : undefined,
        assignees: assigneeIds !== undefined ? { set: (assigneeIds || []).map(id => ({ id })) } : undefined,
        tags: tagIds !== undefined ? { set: (tagIds || []).map(id => ({ id })) } : undefined,
      },
      include: {
        assignees: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        tags: { select: { id: true, name: true, color: true } },
      },
    });

    if (input.status || input.assigneeIds) {
      await NotificationService.notifyTaskActivity(id, 'SYSTEM', 'Task Updated', `Task "${updatedTask.title}" has been updated.`);
    }

    const taskData = await prisma.task.findUnique({
      where: { id },
      include: { 
        list: { select: { space: { select: { organizationId: true } } } },
        project: { select: { organizationId: true } }
      }
    });

    const orgId = taskData?.list?.space?.organizationId || taskData?.project?.organizationId;
    if (orgId) {
      getIO().to(`org:${orgId}`).emit('task:updated', { organizationId: orgId });
      getIO().to(`org:${orgId}`).emit('dashboard:refresh', { organizationId: orgId });
    }

    return updatedTask;
  }

  static async delete(id: string, role: OrgRole) {
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw ApiError.forbidden('Only owners and admins can delete tasks');
    }
    const taskToDel = await prisma.task.findUnique({
      where: { id },
      include: { 
        list: { select: { space: { select: { organizationId: true } } } },
        project: { select: { organizationId: true } }
      }
    });

    if (!taskToDel) throw ApiError.notFound('Task not found');
    const orgId = taskToDel.list?.space?.organizationId || taskToDel.project?.organizationId;
    
    await prisma.task.delete({ where: { id } });

    if (orgId) {
      getIO().to(`org:${orgId}`).emit('task:updated', { organizationId: orgId });
      getIO().to(`org:${orgId}`).emit('dashboard:refresh', { organizationId: orgId });
    }
  }

  static async bulkUpdate(taskIds: string[], input: UpdateTaskInput) {
    if (taskIds.length === 0) throw ApiError.badRequest('No task IDs provided');
    const { assigneeIds, tagIds, ...rest } = input;
    const data: Record<string, any> = { ...rest };

    if (input.dueDate !== undefined) {
      data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    }

    if (assigneeIds !== undefined || tagIds !== undefined) {
      await prisma.$transaction(
        taskIds.map(id =>
          prisma.task.update({
            where: { id },
            data: {
              ...data,
              assignees: assigneeIds !== undefined ? { set: (assigneeIds || []).map(uid => ({ id: uid })) } : undefined,
              tags: tagIds !== undefined ? { set: (tagIds || []).map(tid => ({ id: tid })) } : undefined,
            }
          })
        )
      );
      return { updated: taskIds.length };
    }

    const result = await prisma.task.updateMany({
      where: { id: { in: taskIds } },
      data: data as any,
    });
    return { updated: result.count };
  }

  static async bulkDelete(taskIds: string[]) {
    if (taskIds.length === 0) throw ApiError.badRequest('No task IDs provided');
    const result = await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    return { deleted: result.count };
  }

  static async countByUser(userId: string) {
    return prisma.task.count({
      where: {
        OR: [
          { project: { organization: { members: { some: { userId } } } } },
          { list: { space: { organization: { members: { some: { userId } } } } } }
        ]
      },
    });
  }

  static async getAllTasks(requestingUserId: string, role: OrgRole) {
    const where: Prisma.TaskWhereInput = {};
    if (role === 'MEMBER' || role === 'ADMIN' || role === 'OWNER' || role === 'GUEST') {
      // Full visibility within organization (scoped by query in controller)
    } else if (role === 'LIMITED_MEMBER') {
      where.assignees = { some: { id: requestingUserId } };
    }

    return prisma.task.findMany({
      where,
      include: {
        assignees: { select: { id: true, email: true, firstName: true, lastName: true } },
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        tags: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  static async getAssignedToUser(userId: string) {
    return prisma.task.findMany({
      where: { assignees: { some: { id: userId } } },
      include: {
        assignees: { select: { id: true, email: true, firstName: true, lastName: true } },
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        tags: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }],
    });
  }

  static async getFavorites(userId: string, role: OrgRole) {
    if (role === 'LIMITED_MEMBER' || role === 'GUEST') return [];
    const where: Prisma.TaskWhereInput = {
      isFavorite: true,
      OR: [
        { project: { organization: { members: { some: { userId } } } } },
        { list: { space: { organization: { members: { some: { userId } } } } } }
      ]
    };

    if (role === 'MEMBER') {
      where.assignees = { some: { id: userId } };
    }

    return prisma.task.findMany({
      where,
      include: {
        assignees: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        project: { select: { id: true, name: true } },
        list: { select: { id: true, name: true, folder: { select: { id: true, name: true } } } },
        tags: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
  }
}
