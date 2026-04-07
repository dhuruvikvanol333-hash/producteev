import { Router } from 'express';
import { CommentController } from '../controllers/comment.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const controller = new CommentController();

router.use(authenticate);

router.delete('/:id', controller.delete);

export default router;
