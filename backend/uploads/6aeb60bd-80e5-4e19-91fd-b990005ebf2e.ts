import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { ProjectStatus, OrgRole, Prisma } from '@prisma/client';

interface CreateProjectInput {
  name: string;
  description?: string;
  organizationId: string;
  spaceId?: string;
  createdById: string;
}

interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  spaceId?: string | null;
}

export class ProjectService {
  static async create(input: CreateProjectInput) {
    return prisma.project.create({
      data: {
        name: input.name,
        description: input.description,
        organizationId: input.organizationId,
        spaceId: input.spaceId,
        createdById: input.createdById,
      },
      include: {
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        _count: { select: { tasks: true } },
      },
    });
  }

  static async getByOrganization(organizationId: string, requestingUserId: string, role: OrgRole) {
    const where: Prisma.ProjectWhereInput = { organizationId };

    // RBAC: Members only see projects where they have assigned tasks or they are the creator
    if (role === 'MEMBER') {
      where.OR = [
        { createdById: requestingUserId },
        {
          tasks: {
            some: {
              assignees: {
                some: { id: requestingUserId }
              }
            }
          }
        }
      ];
    } else if (role === 'LIMITED_MEMBER') {
      // Limited members see only projects where they have assigned tasks
      where.tasks = {
        some: {
          assignees: {
            some: { id: requestingUserId }
          }
        }
      };
    }

    return prisma.project.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getById(id: string) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        organization: { select: { id: true, name: true, slug: true } },
        _count: { select: { tasks: true } },
      },
    });

    if (!project) {
      throw ApiError.notFound('Project not found');
    }

    return project;
  }

  static async update(id: string, input: UpdateProjectInput, role: OrgRole) {
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw ApiError.notFound('Project not found');
    }

    // RBAC: Member cannot edit project description
    if (role === 'MEMBER' && input.description !== undefined && input.description !== project.description) {
      throw ApiError.forbidden('Members cannot update project description');
    }

    if (role === 'LIMITED_MEMBER' || role === 'GUEST') {
      throw ApiError.forbidden('You do not have permission to update projects');
    }

    return prisma.project.update({
      where: { id },
      data: input,
      include: {
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        _count: { select: { tasks: true } },
      },
    });
  }

  static async delete(id: string, role: OrgRole) {
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw ApiError.forbidden('Only owners and admins can delete projects');
    }
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw ApiError.notFound('Project not found');
    }

    await prisma.project.delete({ where: { id } });
  }

  static async countByUser(userId: string) {
    return prisma.project.count({
      where: {
        organization: {
          members: { some: { userId } },
        },
      },
    });
  }
}
