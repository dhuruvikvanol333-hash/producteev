import { Request, Response, NextFunction } from 'express';
import { OrgRole } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';

/**
 * Middleware that checks if the authenticated user belongs to the organization
 * specified by :id param. Attaches the membership to req.orgMember.
 */
export const requireOrgMembership = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized();
  }

  const orgId = req.params.id as string | undefined;
  if (!orgId) {
    throw ApiError.badRequest('Organization ID is required');
  }

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId: req.user.id,
      },
    },
  });

  if (!membership) {
    throw ApiError.forbidden('You are not a member of this organization');
  }

  req.orgMember = membership;
  next();
};

/**
 * Middleware factory for task/project create & update routes.
 * Resolves organizationId from body (organizationId or projectId) or from task ID in params,
 * then checks if the user has one of the allowed roles.
 */
export const requireRoleForCreate = (...allowedRoles: OrgRole[]) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    let organizationId: string | undefined;

    // 1. Direct organizationId in body
    if (req.body?.organizationId) {
      organizationId = req.body.organizationId as string;
    }
    // 2. Resolve from body IDs
    else if (req.body?.projectId) {
      const p = await prisma.project.findUnique({ where: { id: req.body.projectId as string }, select: { organizationId: true } });
      organizationId = p?.organizationId;
    } else if (req.body?.spaceId) {
      const s = await prisma.space.findUnique({ where: { id: req.body.spaceId as string }, select: { organizationId: true } });
      organizationId = s?.organizationId;
    } else if (req.body?.folderId) {
      const f = await prisma.folder.findUnique({ where: { id: req.body.folderId as string }, include: { space: { select: { organizationId: true } } } });
      organizationId = f?.space.organizationId;
    } else if (req.body?.listId) {
      const l = await prisma.list.findUnique({ where: { id: req.body.listId as string }, include: { space: { select: { organizationId: true } } } });
      organizationId = l?.space.organizationId;
    }
    // 3. Resolve from param IDs (for update/delete/sub-resources)
    const id = (req.params.id || req.params.taskId || req.params.projectId || req.params.spaceId || req.params.folderId || req.params.listId) as string;
    if (id) {
      if (req.baseUrl.includes('tasks') || req.params.taskId) {
        const t = await prisma.task.findUnique({ 
          where: { id }, 
          include: { 
            project: { select: { organizationId: true } },
            list: { include: { space: { select: { organizationId: true } } } }
          } 
        });
        organizationId = t?.project?.organizationId || t?.list?.space?.organizationId;
      } else if (req.baseUrl.includes('projects') || req.params.projectId) {
        const p = await prisma.project.findUnique({ where: { id }, select: { organizationId: true } });
        organizationId = p?.organizationId;
      } else if (req.baseUrl.includes('spaces') || req.params.spaceId) {
        const s = await prisma.space.findUnique({ where: { id }, select: { organizationId: true } });
        organizationId = s?.organizationId;
      } else if (req.baseUrl.includes('folders') || req.params.folderId) {
        const f = await prisma.folder.findUnique({ where: { id }, include: { space: { select: { organizationId: true } } } });
        organizationId = f?.space?.organizationId;
      } else if (req.baseUrl.includes('lists') || req.params.listId) {
        const l = await prisma.list.findUnique({ where: { id }, include: { space: { select: { organizationId: true } } } });
        organizationId = l?.space?.organizationId;
      }
    }

    if (!organizationId) {
      throw ApiError.badRequest('Unable to determine organization for this action');
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      throw ApiError.forbidden('You are not a member of this organization');
    }

    if (!allowedRoles.includes(membership.role)) {
      throw ApiError.forbidden(
        `This action requires one of the following roles: ${allowedRoles.join(', ')}`
      );
    }

    req.orgMember = membership;
    next();
  };
};

/**
 * Middleware factory that checks if the user has one of the required roles.
 * Must be used after requireOrgMembership.
 */
export const requireOrgRole = (...allowedRoles: OrgRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.orgMember) {
      return next(ApiError.forbidden('Organization membership not verified'));
    }

    if (!allowedRoles.includes(req.orgMember.role)) {
      return next(
        ApiError.forbidden(
          `This action requires one of the following roles: ${allowedRoles.join(', ')}`
        )
      );
    }

    next();
  };
};
