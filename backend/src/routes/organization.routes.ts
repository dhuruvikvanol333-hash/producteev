import { Router } from 'express';
import { OrgRole } from '@prisma/client';
import { OrganizationController } from '../controllers/organization.controller';
import { authenticate, requireAllowedCreator } from '../middleware/auth';
import { requireOrgMembership, requireOrgRole } from '../middleware/organization';
import { orgInvitationRouter } from './invitation.routes';

const router = Router();
const controller = new OrganizationController();

router.use(authenticate);

// Create org & list user's orgs — no org-level auth needed
router.get('/config/init', controller.initialize);
router.post('/', requireAllowedCreator, controller.create);
router.get('/', controller.getMyOrgs);

// Org-specific routes — require membership
router.get('/:id', requireOrgMembership, controller.getById);
router.patch('/:id', requireOrgMembership, requireOrgRole(OrgRole.OWNER, OrgRole.ADMIN), controller.update);
router.delete('/:id', requireOrgMembership, requireOrgRole(OrgRole.OWNER, OrgRole.ADMIN), controller.delete);

// Member management — admin only
router.post('/:id/members', requireOrgMembership, requireOrgRole(OrgRole.OWNER, OrgRole.ADMIN), controller.addMember);
router.patch('/:id/members/:userId', requireOrgMembership, requireOrgRole(OrgRole.OWNER, OrgRole.ADMIN), controller.updateMemberRole);
router.delete('/:id/members/:userId', requireOrgMembership, requireOrgRole(OrgRole.OWNER, OrgRole.ADMIN), controller.removeMember);
router.get('/:id/members', requireOrgMembership, controller.getMembers);
router.get('/:id/invitations', requireOrgMembership, requireOrgRole(OrgRole.OWNER, OrgRole.ADMIN), controller.getInvitations);

router.use('/:id/invitations', orgInvitationRouter);

export default router;
