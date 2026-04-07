import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { getIO } from '../socket';

interface CreateFolderInput {
  name: string;
  color?: string;
  spaceId: string;
}

interface UpdateFolderInput {
  name?: string;
  color?: string;
  position?: number;
}

export class FolderService {
  static async create(input: CreateFolderInput) {
    const space = await prisma.space.findUnique({ where: { id: input.spaceId } });
    if (!space) throw ApiError.notFound('Space not found');

    const maxPos = await prisma.folder.aggregate({
      where: { spaceId: input.spaceId },
      _max: { position: true },
    });

    const result = await prisma.folder.create({
      data: {
        name: input.name,
        color: input.color,
        spaceId: input.spaceId,
        position: (maxPos._max.position ?? -1) + 1,
      },
      include: {
        lists: {
          orderBy: { position: 'asc' },
          include: { _count: { select: { tasks: true } } },
        },
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
    return prisma.folder.findMany({
      where: { spaceId },
      include: {
        lists: {
          orderBy: { position: 'asc' },
          include: { _count: { select: { tasks: true } } },
        },
      },
      orderBy: { position: 'asc' },
    });
  }

  static async getById(id: string) {
    const folder = await prisma.folder.findUnique({
      where: { id },
      include: {
        space: { select: { id: true, name: true, color: true, organizationId: true } },
        lists: {
          orderBy: { position: 'asc' },
          include: { _count: { select: { tasks: true } } },
        },
      },
    });
    if (!folder) throw ApiError.notFound('Folder not found');
    return folder;
  }

  static async update(id: string, input: UpdateFolderInput) {
    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder) throw ApiError.notFound('Folder not found');

    const result = await prisma.folder.update({
      where: { id },
      data: input,
      include: {
        lists: {
          orderBy: { position: 'asc' },
          include: { _count: { select: { tasks: true } } },
        },
      },
    });

    const folderData = await prisma.folder.findUnique({ 
      where: { id }, 
      include: { space: { select: { organizationId: true } } } 
    });
    if (folderData?.space) {
      try {
        getIO().to(`org:${folderData.space.organizationId}`).emit('space:updated', { organizationId: folderData.space.organizationId });
      } catch { }
    }

    return result;
  }

  static async delete(id: string) {
    const folder = await prisma.folder.findUnique({ 
      where: { id },
      include: { space: { select: { organizationId: true } } }
    });
    if (!folder) throw ApiError.notFound('Folder not found');

    await prisma.folder.delete({ where: { id } });

    if (folder.space) {
      try {
        getIO().to(`org:${folder.space.organizationId}`).emit('space:updated', { organizationId: folder.space.organizationId });
        getIO().to(`org:${folder.space.organizationId}`).emit('dashboard:refresh', { organizationId: folder.space.organizationId });
      } catch { }
    }
  }

  static async reorder(spaceId: string, folderIds: string[]) {
    const updates = folderIds.map((id, index) =>
      prisma.folder.update({ where: { id }, data: { position: index } })
    );
    await prisma.$transaction(updates);

    const space = await prisma.space.findUnique({ where: { id: spaceId }, select: { organizationId: true } });
    if (space) {
      try {
        getIO().to(`org:${space.organizationId}`).emit('space:updated', { organizationId: space.organizationId });
      } catch { }
    }
  }
}
