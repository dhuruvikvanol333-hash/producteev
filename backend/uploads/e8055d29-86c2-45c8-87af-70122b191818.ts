import { Request, Response } from 'express';
import { z } from 'zod';
import { OrgRole } from '@prisma/client';
import { InvitationService } from '../services/invitation.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

const createInviteSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.nativeEnum(OrgRole).optional().default(OrgRole.MEMBER),
});

const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export class InvitationController {
  /**
   * POST /organizations/:id/invitations
   * OWNER / ADMIN sends an invitation to an email address.
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { email, role } = createInviteSchema.parse(req.body);
    const organizationId = req.params.id as string;

    const invitation = await InvitationService.createInvite({
      organizationId,
      invitedById: req.user.id,
      email,
      role,
    });

    res.status(201).json({ success: true, data: invitation });
  });

  /**
   * GET /invitations/validate?token=xxx
   * Public — validates a token before registration.
   */
  validate = asyncHandler(async (req: Request, res: Response) => {
    const token = req.query.token as string;
    if (!token) throw ApiError.badRequest('token query param is required');

    const invitation = await InvitationService.validateInvite(token);
    res.json({ success: true, data: invitation });
  });

  /**
   * POST /invitations/accept
   * Authenticated — accepts an invite for the currently logged-in user.
   */
  accept = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { token } = acceptInviteSchema.parse(req.body);
    const result = await InvitationService.acceptInvite(token, req.user.id);

    try {
      const { getIO } = require('../socket');
      getIO().to(`org:${result.organizationId}`).emit('org:member_added', { organizationId: result.organizationId, userId: req.user.id });
      getIO().to(`user:${req.user.id}`).emit('org:membership_updated', { organizationId: result.organizationId });
    } catch (e) {}

    res.json({ success: true, data: result });
  });

  /**
   * GET /organizations/:id/invitations
   * OWNER / ADMIN lists all pending invitations.
   */
  list = asyncHandler(async (req: Request, res: Response) => {
    const invitations = await InvitationService.listInvites(req.params.id as string);
    res.json({ success: true, data: invitations });
  });

  /**
   * DELETE /invitations/:id
   * OWNER / ADMIN revokes a pending invitation.
   */
  delete = asyncHandler(async (req: Request, res: Response) => {
    await InvitationService.revokeInvite(req.params.id as string);
    res.json({ success: true, message: 'Invitation revoked' });
  });
}
