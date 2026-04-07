import { OrgRole, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { cacheAside, cacheDel, CacheKeys } from '../utils/cache';
import { NotificationService } from './notification.service';
import { getIO } from '../socket';

interface CreateOrgInput {
  name: string;
  slug: string;
  ownerId: string;
}

export class OrganizationService {
  static async create(input: CreateOrgInput) {
    let finalSlug = input.slug;
    const existing = await prisma.organization.findUnique({ where: { slug: finalSlug } });
    if (existing) {
      finalSlug = `${finalSlug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    const org = await prisma.organization.create({
      data: {
        name: input.name,
        slug: finalSlug,
        members: {
          create: {
            userId: input.ownerId,
            role: OrgRole.OWNER,
          },
        },
      },
      include: { members: true },
    });

    return org;
  }

  static async getByUserId(userId: string) {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: true,
      },
    });

    return memberships.map((m) => ({
      ...m.organization,
      role: m.role,
    }));
  }

  static async update(orgId: string, data: { name?: string; slug?: string; settings?: Record<string, unknown> }) {
    if (data.slug) {
      const existing = await prisma.organization.findUnique({ where: { slug: data.slug } });
      if (existing && existing.id !== orgId) {
        throw ApiError.conflict('Organization slug already taken');
      }
    }

    const updateData: Prisma.OrganizationUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.settings !== undefined) updateData.settings = data.settings as Prisma.InputJsonValue;

    const result = await prisma.organization.update({
      where: { id: orgId },
      data: updateData,
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    try {
      getIO().to(`org:${orgId}`).emit('org:updated', { organizationId: orgId });
    } catch { }

    return result;
  }

  static async getById(orgId: string) {
    return cacheAside(
      CacheKeys.orgDetails(orgId),
      async () => {
        const org = await prisma.organization.findUnique({
          where: { id: orgId },
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        });

        if (!org) throw ApiError.notFound('Organization not found');
        return org;
      },
      300 // 5 minutes
    );
  }

  static async addMember(orgId: string, userId: string, role: OrgRole = OrgRole.MEMBER) {
    const existing = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });

    if (existing) {
      throw ApiError.conflict('User is already a member of this organization');
    }

    const member = await prisma.organizationMember.create({
      data: { organizationId: orgId, userId, role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Invalidate org cache so member list is fresh
    await cacheDel(CacheKeys.orgDetails(orgId), CacheKeys.orgMembers(orgId));

    try {
      getIO().to(`org:${orgId}`).emit('people:updated', { organizationId: orgId });
      getIO().to(`org:${orgId}`).emit('dashboard:refresh', { organizationId: orgId });
    } catch { }

    return member;
  }

  static async removeMember(orgId: string, userId: string) {
    const member = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });

    if (!member) {
      throw ApiError.notFound('Member not found');
    }

    if (member.role === OrgRole.OWNER) {
      throw ApiError.badRequest('Cannot remove the organization owner');
    }

    await prisma.organizationMember.delete({
      where: { id: member.id },
    });

    // Invalidate org member cache
    await cacheDel(CacheKeys.orgDetails(orgId), CacheKeys.orgMembers(orgId));

    try {
      getIO().to(`org:${orgId}`).emit('people:updated', { organizationId: orgId });
      getIO().to(`org:${orgId}`).emit('dashboard:refresh', { organizationId: orgId });
    } catch { }
  }

  static async listMembers(orgId: string) {
    return prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            technology: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async updateMemberRole(orgId: string, userId: string, role: OrgRole) {
    const member = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });

    if (!member) throw ApiError.notFound('Member not found');
    if (member.role === OrgRole.OWNER && role !== OrgRole.OWNER) {
      throw ApiError.badRequest('Cannot change the role of the organization owner');
    }

    const updated = await prisma.organizationMember.update({
      where: { id: member.id },
      data: { role },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    // Notify the user about their role change
    await NotificationService.create(
      userId,
      'Role Updated',
      `Your role in the organization has been updated to ${role}.`,
      '/settings'
    );

    await cacheDel(CacheKeys.orgDetails(orgId), CacheKeys.orgMembers(orgId));

    try {
      const { getIO } = require('../socket');
      getIO().to(`org:${orgId}`).emit('people:updated', { organizationId: orgId });
      getIO().to(`org:${orgId}`).emit('dashboard:refresh', { organizationId: orgId });
      getIO().to(`user:${userId}`).emit('org:role_updated', { organizationId: orgId, newRole: role });
    } catch { }

    return updated;
  }
}
