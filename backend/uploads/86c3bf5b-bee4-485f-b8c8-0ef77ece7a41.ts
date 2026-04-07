import { Router } from 'express';
import { OrgRole } from '@prisma/client';
import { SpaceController } from '../controllers/space.controller';
import { authenticate } from '../middleware/auth';
import { requireRoleForCreate } from '../middleware/organization';

const router = Router();
const controller = new SpaceController();

router.use(authenticate);

router.post('/', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), controller.create);
router.get('/my', controller.getByUser);
router.get('/org/:organizationId/memberships/:userId', controller.getByUserId);
router.post('/org/:organizationId/memberships/:userId', controller.setUserSpaces);
router.get('/org/:organizationId/granular-memberships/:userId', controller.getUserGranularMemberships);
router.post('/org/:organizationId/granular-memberships/:userId', controller.setUserGranularMemberships);
router.get('/org/:organizationId', controller.getByOrganization);
router.get('/:id', controller.getById);
router.patch('/:id', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), controller.update);
router.delete('/:id', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), controller.delete);

// Membership management
router.get('/:id/members', controller.listMembers);
router.post('/:id/members', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN), controller.addMember);
router.delete('/:id/members/:userId', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN), controller.removeMember);
router.post('/:id/members/sync', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN), controller.syncMembers);

export default router;
