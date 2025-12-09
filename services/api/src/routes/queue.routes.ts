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
import { tokenAuthPayload } from '../middleware/tokenAuthPayload';

const router = Router();

// Queue operations require token authentication
// Join queue uses token from payload, status uses token from header
router.post('/join', tokenAuthPayload, queueJoinLimiter, validate(joinQueueSchema), validateQueueAccess, asyncHandler(joinQueue));
router.get('/status', tokenAuth, queueStatusLimiter, validate(queueStatusSchema), asyncHandler(getQueueStatus));

export default router;

