import { OrgRole, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';

export class TaskService {
  static async create(data: any) {
    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        status: data.status || 'OPEN',
        priority: data.priority || 'MEDIUM',
        startDate: data.startDate ? new Date(data.startDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        projectId: data.projectId,
        listId: data.listId,
        createdById: data.createdById,
        assignees: {
          connect: (data.assigneeIds || []).map((id: string) => ({ id })),
        },
        tags: {
          connect: (data.tagIds || []).map((id: string) => ({ id })),
        },
      },
      include: {
        assignees: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        tags: { select: { id: true, name: true, color: true } },
      },
    });

    if (data.isFavorite) {
      await prisma.userTaskFavorite.create({
        data: { userId: data.createdById, taskId: task.id }
      });
    }

    return task;
  }

  static async update(id: string, data: any, userId: string) {
    const updateData: Prisma.TaskUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.listId !== undefined) updateData.list = { connect: { id: data.listId } };

    if (data.assigneeIds !== undefined) {
      updateData.assignees = {
        set: (data.assigneeIds || []).map((id: string) => ({ id })),
      };
    }

    if (data.tagIds !== undefined) {
      updateData.tags = {
        set: (data.tagIds || []).map((id: string) => ({ id })),
      };
    }

    // Toggle favorite state
    if (data.isFavorite !== undefined) {
      if (data.isFavorite) {
        await prisma.userTaskFavorite.upsert({
          where: { userId_taskId: { userId, taskId: id } },
          create: { userId, taskId: id },
          update: {}
        });
      } else {
        await prisma.userTaskFavorite.deleteMany({
          where: { userId, taskId: id }
        });
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignees: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        project: { select: { id: true, name: true } },
        list: { select: { id: true, name: true, folder: { select: { id: true, name: true } } } },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        tags: { select: { id: true, name: true, color: true } },
        favoritedBy: { where: { userId } }
      },
    });

    return {
      ...task,
      isFavorite: task.favoritedBy.length > 0
    };
  }

  static async delete(id: string) {
    await prisma.task.delete({ where: { id } });
  }

  static async bulkUpdate(ids: string[], data: any) {
    const { status, priority, assigneeIds } = data;
    const updateData: any = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;

    if (Object.keys(updateData).length > 0) {
      await prisma.task.updateMany({
        where: { id: { in: ids } },
        data: updateData,
      });
    }

    // Handle relations for bulk separately (Prisma updateMany doesn't support nested writes)
    if (assigneeIds !== undefined) {
      for (const id of ids) {
        await prisma.task.update({
          where: { id },
          data: { assignees: { set: (assigneeIds || []).map((uid: string) => ({ id: uid })) } }
        });
      }
    }

    return { updated: ids.length };
  }

  static async bulkDelete(ids: string[]) {
    await prisma.task.deleteMany({ where: { id: { in: ids } } });
    return { deleted: ids.length };
  }

  static async getById(id: string, userId: string) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignees: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        project: { select: { id: true, name: true, organizationId: true } },
        list: { select: { id: true, name: true, space: { select: { organizationId: true } } } },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        tags: { select: { id: true, name: true, color: true } },
        favoritedBy: { where: { userId } }
      },
    });

    if (!task) throw ApiError.notFound('Task not found');
    return {
      ...task,
      isFavorite: task.favoritedBy.length > 0
    };
  }

  static async getByProject(filters: any, userId: string, role: OrgRole) {
    const where: Prisma.TaskWhereInput = {
      projectId: filters.projectId,
      listId: filters.listId,
      status: filters.status,
      priority: filters.priority,
    };

    if (filters.assigneeIds && filters.assigneeIds.length > 0) {
      where.assignees = { some: { id: { in: filters.assigneeIds } } };
    }

    if (role === 'LIMITED_MEMBER') {
      // Limited members only see their assigned tasks
      where.assignees = { some: { id: userId } };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignees: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        tags: { select: { id: true, name: true, color: true } },
        favoritedBy: { where: { userId } }
      },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    });

    return tasks.map(t => ({
      ...t,
      isFavorite: (t as any).favoritedBy.length > 0
    }));
  }

  static async getAssignedToUser(userId: string, organizationId?: string) {
    const where: Prisma.TaskWhereInput = {
      assignees: { some: { id: userId } },
    };

    if (organizationId) {
      where.OR = [
        { project: { organizationId } },
        { list: { space: { organizationId } } }
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignees: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        tags: { select: { id: true, name: true, color: true } },
        favoritedBy: { where: { userId } }
      },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }],
    });

    return tasks.map(t => ({
      ...t,
      isFavorite: (t as any).favoritedBy.length > 0
    }));
  }

  static async getAllTasks(requestingUserId: string, role: OrgRole, organizationId?: string, limit?: number) {
    const where: Prisma.TaskWhereInput = {};
    if (organizationId) {
      where.OR = [
        { project: { organizationId } },
        { list: { space: { organizationId } } }
      ];
    }

    if (role === 'LIMITED_MEMBER') {
      where.assignees = { some: { id: requestingUserId } };
    }

    const tasks = await prisma.task.findMany({
      where,
      take: limit,
      include: {
        assignees: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        tags: { select: { id: true, name: true, color: true } },
        favoritedBy: { where: { userId: requestingUserId } }
      },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    });

    return tasks.map(t => ({
      ...t,
      isFavorite: (t as any).favoritedBy.length > 0
    }));
  }

  static async getFavorites(userId: string, organizationId?: string) {
    let where: Prisma.TaskWhereInput = {
      favoritedBy: { some: { userId } }
    };

    if (organizationId) {
      where = {
        AND: [
          { favoritedBy: { some: { userId } } },
          {
            OR: [
              { project: { organizationId } },
              { list: { space: { organizationId } } }
            ]
          }
        ]
      };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignees: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        project: { select: { id: true, name: true } },
        list: { select: { id: true, name: true, folder: { select: { id: true, name: true } } } },
        tags: { select: { id: true, name: true, color: true } },
        favoritedBy: { where: { userId } }
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return tasks.map(t => ({
      ...t,
      isFavorite: (t as any).favoritedBy.length > 0
    }));
  }
}
