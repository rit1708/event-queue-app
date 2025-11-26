import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validator';
import { queueJoinLimiter, queueStatusLimiter } from '../middleware/rateLimiter';
import {
  joinQueueSchema,
  queueStatusSchema,
} from '../schemas/event.schema';
import {
  joinQueue,
  getQueueStatus,
} from '../controllers/queue.controller';
import { validateQueueAccess } from '../middleware/queueValidator';

const router = Router();

router.post('/join', queueJoinLimiter, validate(joinQueueSchema), validateQueueAccess, asyncHandler(joinQueue));
router.get('/status', queueStatusLimiter, validate(queueStatusSchema), asyncHandler(getQueueStatus));

export default router;

