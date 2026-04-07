import { prisma } from '../config/database';
import type { Prisma } from '@prisma/client';

interface LogActivityInput {
  orgId?: string;
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  changes?: Prisma.InputJsonValue;
}

export class ActivityService {
  static async log(input: LogActivityInput) {
    return prisma.activity.create({
      data: {
        orgId: input.orgId,
        userId: input.userId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        changes: input.changes || {},
      },
    });
  }

  static async getByEntity(entityType: string, entityId: string, limit = 50, offset = 0) {
    return prisma.activity.findMany({
      where: { entityType, entityId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  static async getByListTasks(listId: string, limit = 50, offset = 0) {
    // Get all task IDs in this list
    const tasks = await prisma.task.findMany({
      where: { listId },
      select: { id: true },
    });
    const taskIds = tasks.map((t) => t.id);

    if (taskIds.length === 0) return [];

    return prisma.activity.findMany({
      where: {
        entityType: 'task',
        entityId: { in: taskIds },
      },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  static async getByOrganization(orgId: string, limit = 50, offset = 0) {
    return prisma.activity.findMany({
      where: { orgId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }
}
