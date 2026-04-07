import { Request, Response } from 'express';
import { z } from 'zod';
import { OrgRole } from '@prisma/client';
import { OrganizationService } from '../services/organization.service';
import { InvitationService } from '../services/invitation.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { getIO } from '../socket';
import { prisma } from '../config/database';

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  settings: z.record(z.unknown()).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(OrgRole).optional(),
});

export class OrganizationController {
  create = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = createSchema.parse(req.body);
    const org = await OrganizationService.create({
      ...data,
      ownerId: req.user.id,
    });
    res.status(201).json({ success: true, data: org });
  });

  getMyOrgs = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const orgs = await OrganizationService.getByUserId(req.user.id);
    res.json({ success: true, data: orgs });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const org = await OrganizationService.getById(req.params.id as string);
    res.json({ success: true, data: org });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const data = updateSchema.parse(req.body);
    const org = await OrganizationService.update(req.params.id as string, data);
    res.json({ success: true, data: org });
  });

  addMember = asyncHandler(async (req: Request, res: Response) => {
    const data = addMemberSchema.parse(req.body);
    const member = await OrganizationService.addMember(
      req.params.id as string,
      data.userId,
      data.role
    );

    try {
      getIO().to(`org:${req.params.id}`).emit('org:member_added', { organizationId: req.params.id, member });
      getIO().to(`user:${data.userId}`).emit('org:membership_updated', { organizationId: req.params.id });
    } catch (e) { }

    res.status(201).json({ success: true, data: member });
  });

  removeMember = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.params.userId as string;
    await OrganizationService.removeMember(id, userId);

    try {
      getIO().to(`org:${id}`).emit('org:member_removed', { organizationId: id, userId });
      getIO().to(`user:${userId}`).emit('org:membership_updated', { organizationId: id });
    } catch (e) { }

    res.json({ success: true, message: 'Member removed' });
  });

  getMembers = asyncHandler(async (req: Request, res: Response) => {
    const members = await OrganizationService.listMembers(req.params.id as string);
    res.json({ success: true, data: members });
  });

  updateMemberRole = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.params.userId as string;
    const { role } = z.object({ role: z.nativeEnum(OrgRole) }).parse(req.body);

    // Security: Admins cannot change roles of other Admins or Owners
    if (req.orgMember?.role === OrgRole.ADMIN) {
      const targetMember = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: id, userId } },
      });
      if (targetMember?.role === OrgRole.ADMIN || targetMember?.role === OrgRole.OWNER) {
        throw ApiError.forbidden('Admins cannot change roles of other Admins or Owners');
      }
    }

    const member = await OrganizationService.updateMemberRole(id, userId, role);

    try {
      getIO().to(`org:${id}`).emit('org:role_changed', { organizationId: id, userId, role });
      getIO().to(`user:${userId}`).emit('org:membership_updated', { organizationId: id });
    } catch (e) { }

    res.json({ success: true, data: member });
  });

  getInvitations = asyncHandler(async (req: Request, res: Response) => {
    const invits = await InvitationService.listInvites(req.params.id as string);
    res.json({ success: true, data: invits });
  });
}
