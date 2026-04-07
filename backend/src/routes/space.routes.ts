import { Router } from 'express';
import { OrgRole } from '@prisma/client';
import { SpaceController } from '../controllers/space.controller';
import { authenticate } from '../middleware/auth';
import { requireRoleForCreate, requireResourceAccess } from '../middleware/organization';

const router = Router();
const controller = new SpaceController();

router.use(authenticate);

router.post('/', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), controller.create);
router.get('/my', controller.getByUser);
router.get('/my', controller.getByUser);
router.get('/org/:organizationId/memberships/:userId', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN), controller.getByUserId);
router.post('/org/:organizationId/memberships/:userId', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN), controller.setUserSpaces);
router.get('/org/:organizationId/granular-memberships/:userId', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN), controller.getUserGranularMemberships);
router.post('/org/:organizationId/granular-memberships/:userId', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN), controller.setUserGranularMemberships);
router.get('/org/:organizationId', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN), controller.getByOrganization);
router.get('/:id', requireResourceAccess, controller.getById);
router.patch('/:id', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), controller.update);
router.delete('/:id', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), controller.delete);

// Membership management
router.get('/:id/members', requireResourceAccess, controller.listMembers);
router.post('/:id/members', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN), controller.addMember);
router.delete('/:id/members/:userId', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN), controller.removeMember);
router.post('/:id/members/sync', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN), controller.syncMembers);
router.get('/:id/stats', requireResourceAccess, controller.getStats);
router.get('/:id/tasks', requireResourceAccess, controller.getTasks);

export default router;
