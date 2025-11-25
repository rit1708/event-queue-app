import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validator';
import { adminReadLimiter, adminWriteLimiter } from '../middleware/rateLimiter';
import {
  createDomainSchema,
  eventIdSchema,
  eventUsersSchema,
  enqueueUserSchema,
  enqueueBatchSchema,
  startQueueSchema,
  stopQueueSchema,
} from '../schemas/event.schema';
import { createDomain, getDomains } from '../controllers/domain.controller';
import {
  advanceQueueManually,
  getQueueUsers,
  startQueue,
  stopQueue,
  enqueueUserAdmin,
  enqueueBatch,
} from '../controllers/queue.controller';
import { Request, Response } from 'express';
import {
  ensureDomainAvailable,
} from '../middleware/domainValidator';

const router = Router();

// Domain routes
router.post(
  '/domain',
  adminWriteLimiter,
  validate(createDomainSchema),
  ensureDomainAvailable,
  asyncHandler(createDomain)
);
router.get('/domain', adminReadLimiter, asyncHandler(getDomains));

// Event routes
router.get('/event/users', adminReadLimiter, validate(eventUsersSchema), asyncHandler(getQueueUsers));
router.post('/event/:id/advance', adminWriteLimiter, validate(eventIdSchema), asyncHandler(advanceQueueManually));
router.post('/event/start', adminWriteLimiter, validate(startQueueSchema), asyncHandler(startQueue));
router.post('/event/stop', adminWriteLimiter, validate(stopQueueSchema), asyncHandler(stopQueue));
router.post('/event/enqueue', adminWriteLimiter, validate(enqueueUserSchema), asyncHandler(enqueueUserAdmin));
router.post('/event/enqueue-batch', adminWriteLimiter, validate(enqueueBatchSchema), asyncHandler(enqueueBatch));

// Entry history
router.get('/event/entries', adminReadLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { getDb } = await import('../db/mongo');
  const eventId = String(req.query.eventId || '');
  if (!eventId) {
    return res.status(400).json({ error: 'eventId required' });
  }
  const db = await getDb();
  const list = await db
    .collection('entries')
    .find({ eventId })
    .project({ _id: 0 })
    .sort({ enteredAt: -1 })
    .limit(200)
    .toArray();
  res.json(list);
}));

export default router;

