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
import { tokenAuth } from '../middleware/tokenAuth';

const router = Router();

// Queue operations require token authentication
router.post('/join', tokenAuth, queueJoinLimiter, validate(joinQueueSchema), validateQueueAccess, asyncHandler(joinQueue));
router.get('/status', tokenAuth, queueStatusLimiter, validate(queueStatusSchema), asyncHandler(getQueueStatus));

export default router;

