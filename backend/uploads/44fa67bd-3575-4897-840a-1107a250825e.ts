import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { getIO } from '../socket';

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
  static async create(input: CreateListInput) {
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
      } catch { }
    }

    return result;
  }

  static async getBySpace(spaceId: string) {
    return prisma.list.findMany({
      where: { spaceId, folderId: null },
      include: { _count: { select: { tasks: true } } },
      orderBy: { position: 'asc' },
    });
  }

  static async getByFolder(folderId: string) {
    return prisma.list.findMany({
      where: { folderId },
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

  static async update(id: string, input: UpdateListInput) {
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
      } catch { }
    }

    return result;
  }

  static async delete(id: string) {
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
