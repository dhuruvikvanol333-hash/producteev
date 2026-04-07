import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { getIO } from '../socket';

interface CreateSpaceInput {
  name: string;
  color?: string;
  organizationId: string;
  createdById: string;
}

interface UpdateSpaceInput {
  name?: string;
  color?: string;
}

export class SpaceService {
  static async create(input: CreateSpaceInput) {
    const result = await prisma.space.create({
      data: {
        name: input.name,
        color: input.color,
        organizationId: input.organizationId,
        createdById: input.createdById,
        members: {
          create: { userId: input.createdById }
        }
      },
      include: {
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        organization: { select: { id: true, name: true, slug: true } },
        projects: {
          include: {
            _count: { select: { tasks: true } },
          },
        },
        folders: {
          orderBy: { position: 'asc' },
          include: {
            lists: {
              orderBy: { position: 'asc' },
              include: { _count: { select: { tasks: true } } },
            },
          },
        },
        lists: {
          where: { folderId: null },
          orderBy: { position: 'asc' },
          include: { _count: { select: { tasks: true } } },
        },
        _count: { select: { projects: true, folders: true, lists: true } },
      },
    });

    try {
      getIO().to(`org:${input.organizationId}`).emit('space:updated', { organizationId: input.organizationId });
    } catch { }

    return result;
  }

  static async getByOrganization(organizationId: string) {
    return prisma.space.findMany({
      where: { organizationId },
      include: {
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        projects: {
          include: {
            _count: { select: { tasks: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        folders: {
          orderBy: { position: 'asc' },
          include: {
            lists: {
              orderBy: { position: 'asc' },
              include: { _count: { select: { tasks: true } } },
            },
          },
        },
        lists: {
          where: { folderId: null },
          orderBy: { position: 'asc' },
          include: { _count: { select: { tasks: true } } },
        },
        _count: { select: { projects: true, folders: true, lists: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async getByUser(userId: string) {
    // 1. Get all memberships for the user to understand their roles in each organization
    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true, role: true },
    });

    console.log(`[SpaceService] Found ${memberships.length} memberships for user ${userId}`);

    const results = [];

    // 2. For each membership, fetch spaces according to the role
    for (const membership of memberships) {
      if (membership.role === 'OWNER') {
        // ONLY the Owner has full access to all organization assets
        const orgSpaces = await prisma.space.findMany({
          where: { organizationId: membership.organizationId },
          include: {
            createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
            organization: { select: { id: true, name: true, slug: true } },
            projects: {
              include: { _count: { select: { tasks: true } } },
              orderBy: { createdAt: 'asc' },
            },
            folders: {
              orderBy: { position: 'asc' },
              include: {
                lists: {
                  orderBy: { position: 'asc' },
                  include: { _count: { select: { tasks: true } } },
                },
              },
            },
            lists: {
              where: { folderId: null },
              orderBy: { position: 'asc' },
              include: { _count: { select: { tasks: true } } },
            },
            _count: { select: { projects: true, folders: true, lists: true } },
          },
          orderBy: { createdAt: 'asc' },
        });
        results.push(...orgSpaces);
      } else {
        // Admins, Members and others now see ONLY spaces they are explicitly assigned to 
        // This allows 'Admins' to manage people without seeing all organization content
        const assignedSpaces = await prisma.space.findMany({
          where: {
            organizationId: membership.organizationId,
            members: { some: { userId } },
          },
          include: {
            createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
            organization: { select: { id: true, name: true, slug: true } },
            projects: {
              include: { _count: { select: { tasks: true } } },
              orderBy: { createdAt: 'asc' },
            },
            folders: {
              where: { members: { some: { userId } } },
              orderBy: { position: 'asc' },
              include: {
                lists: {
                  where: { members: { some: { userId } } },
                  orderBy: { position: 'asc' },
                  include: { _count: { select: { tasks: true } } },
                },
              },
            },
            lists: {
              where: {
                folderId: null,
                members: { some: { userId } }
              },
              orderBy: { position: 'asc' },
              include: { _count: { select: { tasks: true } } },
            },
            _count: { select: { projects: true, folders: true, lists: true } },
          },
          orderBy: { createdAt: 'asc' },
        });
        results.push(...assignedSpaces);
      }
    }

    return results;
  }

  static async getById(id: string) {
    const space = await prisma.space.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        organization: { select: { id: true, name: true, slug: true } },
        projects: {
          include: {
            createdBy: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
            _count: { select: { tasks: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { projects: true } },
      },
    });

    if (!space) {
      throw ApiError.notFound('Space not found');
    }

    return space;
  }

  static async update(id: string, input: UpdateSpaceInput) {
    const space = await prisma.space.findUnique({ where: { id } });
    if (!space) {
      throw ApiError.notFound('Space not found');
    }

    const result = await prisma.space.update({
      where: { id },
      data: input,
      include: {
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        projects: {
          include: {
            _count: { select: { tasks: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { projects: true } },
      },
    });

    try {
      getIO().to(`org:${result.organizationId}`).emit('space:updated', { organizationId: result.organizationId });
    } catch { }

    return result;
  }

  static async delete(id: string) {
    const space = await prisma.space.findUnique({ where: { id } });
    if (!space) {
      throw ApiError.notFound('Space not found');
    }

    // Nullify spaceId on all projects in this space before deleting
    await prisma.project.updateMany({
      where: { spaceId: id },
      data: { spaceId: null },
    });

    await prisma.space.delete({ where: { id } });

    try {
      getIO().to(`org:${space.organizationId}`).emit('space:updated', { organizationId: space.organizationId });
    } catch { }
  }

  // Membership management
  static async addMember(spaceId: string, userId: string) {
    return prisma.spaceMember.upsert({
      where: { spaceId_userId: { spaceId, userId } },
      update: {},
      create: { spaceId, userId },
    });
  }

  static async removeMember(spaceId: string, userId: string) {
    return prisma.spaceMember.deleteMany({
      where: { spaceId, userId },
    });
  }

  static async listMembers(spaceId: string) {
    return prisma.spaceMember.findMany({
      where: { spaceId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });
  }

  static async setMembers(spaceId: string, userIds: string[]) {
    return prisma.$transaction(async (tx) => {
      // 1. Remove members not in the new list
      await tx.spaceMember.deleteMany({
        where: {
          spaceId,
          userId: { notIn: userIds },
        },
      });

      // 2. Add new members
      const promises = userIds.map((userId) =>
        tx.spaceMember.upsert({
          where: { spaceId_userId: { spaceId, userId } },
          update: {},
          create: { spaceId, userId },
        })
      );
      await Promise.all(promises);

      const result = await tx.spaceMember.findMany({
        where: { spaceId },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
          },
        },
      });

      // Fetch orgId for emission
      const space = await tx.space.findUnique({ where: { id: spaceId }, select: { organizationId: true } });
      if (space) {
        try {
          getIO().to(`org:${space.organizationId}`).emit('space:updated', { organizationId: space.organizationId });
          getIO().to(`org:${space.organizationId}`).emit('people:updated', { organizationId: space.organizationId });
        } catch { }
      }

      return result;
    });
  }
  static async getUserMembershipsInOrg(organizationId: string, userId: string) {
    return prisma.spaceMember.findMany({
      where: {
        userId,
        space: { organizationId }
      },
      select: { spaceId: true }
    });
  }

  static async setUserSpacesInOrg(organizationId: string, userId: string, spaceIds: string[]) {
    return prisma.$transaction(async (tx) => {
      // 1. Remove all existing memberships in this organization
      await tx.spaceMember.deleteMany({
        where: {
          userId,
          space: { organizationId }
        }
      });

      // 2. Add new memberships
      if (spaceIds.length > 0) {
        await tx.spaceMember.createMany({
          data: spaceIds.map(spaceId => ({
            userId,
            spaceId
          }))
        });
      }

      return this.getUserMembershipsInOrg(organizationId, userId);
    });
  }

  static async getUserGranularMemberships(organizationId: string, userId: string) {
    const spaces = await prisma.spaceMember.findMany({
      where: { userId, space: { organizationId } },
      select: { spaceId: true, role: true }
    });

    const folders = await prisma.folderMember.findMany({
      where: { userId, folder: { space: { organizationId } } },
      select: { folderId: true, role: true }
    });

    const lists = await prisma.listMember.findMany({
      where: { userId, list: { space: { organizationId } } },
      select: { listId: true, role: true }
    });

    return {
      spaceIds: spaces.map(s => s.spaceId),
      folderIds: folders.map(f => f.folderId),
      listIds: lists.map(l => l.listId),
      spaceAdmins: spaces.filter(s => s.role === 'ADMIN').map(s => s.spaceId),
      folderAdmins: folders.filter(f => f.role === 'ADMIN').map(f => f.folderId),
      listAdmins: lists.filter(l => l.role === 'ADMIN').map(l => l.listId),
    };
  }

  static async setUserGranularMemberships(
    organizationId: string,
    userId: string,
    data: {
      spaceIds: string[],
      folderIds: string[],
      listIds: string[],
      spaceAdmins?: string[],
      folderAdmins?: string[],
      listAdmins?: string[]
    }
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Update Spaces
      await tx.spaceMember.deleteMany({
        where: { userId, space: { organizationId } }
      });
      if (data.spaceIds.length > 0) {
        await tx.spaceMember.createMany({
          data: data.spaceIds.map(spaceId => ({
            userId,
            spaceId,
            role: (data.spaceAdmins || []).includes(spaceId) ? 'ADMIN' : 'MEMBER'
          }))
        });
      }

      // 2. Update Folders
      await tx.folderMember.deleteMany({
        where: { userId, folder: { space: { organizationId } } }
      });
      if (data.folderIds.length > 0) {
        await tx.folderMember.createMany({
          data: data.folderIds.map(folderId => ({
            userId,
            folderId,
            role: (data.folderAdmins || []).includes(folderId) ? 'ADMIN' : 'MEMBER'
          }))
        });
      }

      // 3. Update Lists
      await tx.listMember.deleteMany({
        where: { userId, list: { space: { organizationId } } }
      });
      if (data.listIds.length > 0) {
        await tx.listMember.createMany({
          data: data.listIds.map(listId => ({
            userId,
            listId,
            role: (data.listAdmins || []).includes(listId) ? 'ADMIN' : 'MEMBER'
          }))
        });
      }

      return this.getUserGranularMemberships(organizationId, userId);
    });
  }
}
