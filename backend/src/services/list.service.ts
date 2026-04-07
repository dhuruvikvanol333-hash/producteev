import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { getIO } from '../socket';
import { OrgRole } from '@prisma/client';
import { NotificationService } from './notification.service';

interface CreateListInput {
  name: string;
  color?: string;
  spaceId: string;
  folderId?: string;
}

interface UpdateListInput {
  name?: string;
  color?: string;
  position?: number;
  folderId?: string | null;
}

export class ListService {
  static async create(input: CreateListInput, actorId: string, role: OrgRole) {
    const targetSpace = await prisma.space.findUnique({ where: { id: input.spaceId } });
    if (!targetSpace) throw ApiError.notFound('Space not found');

    if (input.folderId) {
      const folder = await prisma.folder.findUnique({ where: { id: input.folderId } });
      if (!folder) throw ApiError.notFound('Folder not found');
    }

    const maxPos = await prisma.list.aggregate({
      where: { spaceId: input.spaceId, folderId: input.folderId ?? null },
      _max: { position: true },
    });

    const result = await prisma.list.create({
      data: {
        name: input.name,
        color: input.color,
        spaceId: input.spaceId,
        folderId: input.folderId ?? null,
        position: (maxPos._max.position ?? -1) + 1,
      },
      include: {
        _count: { select: { tasks: true } },
      },
    });

    const spaceData = await prisma.space.findUnique({ where: { id: input.spaceId }, select: { organizationId: true } });
    if (spaceData) {
      try {
        getIO().to(`org:${spaceData.organizationId}`).emit('space:updated', { organizationId: spaceData.organizationId });
        getIO().to(`org:${spaceData.organizationId}`).emit('dashboard:refresh', { organizationId: spaceData.organizationId });
        
        const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { firstName: true, lastName: true } });
        const actorName = actor ? `${actor.firstName} ${actor.lastName}` : 'Someone';

        if (role === 'MEMBER') {
          await NotificationService.notifyAdmins(spaceData.organizationId, actorId, result.name, `${actorName} created a new list: ${result.name}`);
        } else if (role === 'ADMIN' || role === 'OWNER') {
          await NotificationService.notifyMembers(spaceData.organizationId, actorId, result.name, `${actorName} created a new list: ${result.name}`);
        }
      } catch { }
    }

    return result;
  }

  static async getBySpace(spaceId: string, userId: string, role: string) {
    const where: any = { spaceId, folderId: null };

    if (role !== 'ADMIN' && role !== 'OWNER') {
      where.members = { some: { userId } };
    }

    return prisma.list.findMany({
      where,
      include: { _count: { select: { tasks: true } } },
      orderBy: { position: 'asc' },
    });
  }

  static async getByFolder(folderId: string, userId: string, role: string) {
    const where: any = { folderId };

    if (role !== 'ADMIN' && role !== 'OWNER') {
      where.members = { some: { userId } };
    }

    return prisma.list.findMany({
      where,
      include: { _count: { select: { tasks: true } } },
      orderBy: { position: 'asc' },
    });
  }

  static async getById(id: string) {
    const list = await prisma.list.findUnique({
      where: { id },
      include: {
        space: { select: { id: true, name: true, color: true, organizationId: true } },
        folder: { select: { id: true, name: true } },
        tasks: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            assignees: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
        statuses: { orderBy: { position: 'asc' } },
        _count: { select: { tasks: true } },
      },
    });
    if (!list) throw ApiError.notFound('List not found');
    return list;
  }

  static async update(id: string, input: UpdateListInput, actorId: string, role: OrgRole) {
    const list = await prisma.list.findUnique({ where: { id } });
    if (!list) throw ApiError.notFound('List not found');

    const result = await prisma.list.update({
      where: { id },
      data: input,
      include: { _count: { select: { tasks: true } } },
    });

    const listData = await prisma.list.findUnique({ 
      where: { id },
      include: { space: { select: { organizationId: true } } }
    });
    if (listData?.space) {
      try {
        getIO().to(`org:${listData.space.organizationId}`).emit('space:updated', { organizationId: listData.space.organizationId });
        
        const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { firstName: true, lastName: true } });
        const actorName = actor ? `${actor.firstName} ${actor.lastName}` : 'Someone';

        if (role === 'MEMBER') {
          await NotificationService.notifyAdmins(listData.space.organizationId, actorId, result.name, `${actorName} updated list: ${result.name}`);
        } else if (role === 'ADMIN' || role === 'OWNER') {
          await NotificationService.notifyMembers(listData.space.organizationId, actorId, result.name, `${actorName} updated list: ${result.name}`);
        }
      } catch { }
    }

    return result;
  }

  static async delete(id: string, actorId: string, role: OrgRole) {
    const list = await prisma.list.findUnique({ 
      where: { id },
      include: { space: { select: { organizationId: true } } }
    });
    if (!list) throw ApiError.notFound('List not found');
    await prisma.list.delete({ where: { id } });

    if (list.space) {
      try {
        getIO().to(`org:${list.space.organizationId}`).emit('space:updated', { organizationId: list.space.organizationId });
        getIO().to(`org:${list.space.organizationId}`).emit('dashboard:refresh', { organizationId: list.space.organizationId });

        const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { firstName: true, lastName: true } });
        const actorName = actor ? `${actor.firstName} ${actor.lastName}` : 'Someone';

        if (role === 'MEMBER') {
          await NotificationService.notifyAdmins(list.space.organizationId, actorId, list.name, `${actorName} deleted list: ${list.name}`);
        } else if (role === 'ADMIN' || role === 'OWNER') {
          await NotificationService.notifyMembers(list.space.organizationId, actorId, list.name, `${actorName} deleted list: ${list.name}`);
        }
      } catch { }
    }
  }

  static async reorder(ids: string[]) {
    const updates = ids.map((id, index) =>
      prisma.list.update({ where: { id }, data: { position: index } })
    );
    await prisma.$transaction(updates);
  }
}
