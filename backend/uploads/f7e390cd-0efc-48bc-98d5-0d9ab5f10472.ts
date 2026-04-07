import { Router } from 'express';
import { OrgRole } from '@prisma/client';
import { ListController } from '../controllers/list.controller';
import { authenticate } from '../middleware/auth';
import { requireRoleForCreate } from '../middleware/organization';

const router = Router();
const controller = new ListController();

router.use(authenticate);

router.post('/', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), controller.create);
router.get('/space/:spaceId', controller.getBySpace);
router.get('/folder/:folderId', controller.getByFolder);
router.get('/:id', controller.getById);
router.patch('/:id', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), controller.update);
router.delete('/:id', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), controller.delete);
router.put('/reorder', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), controller.reorder);

export default router;
