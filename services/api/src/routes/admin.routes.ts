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
  createEventSchema,
  updateEventSchema,
} from '../schemas/event.schema';
import {
  generateTokenSchema,
  tokenIdSchema,
  revokeTokenSchema,
} from '../schemas/token.schema';
import { createDomain, getDomains } from '../controllers/domain.controller';
import {
  advanceQueueManually,
  getQueueUsers,
  startQueue,
  stopQueue,
  enqueueUserAdmin,
  enqueueBatch,
} from '../controllers/queue.controller';
import {
  createEvent,
  updateEvent,
  deleteEvent,
} from '../controllers/event.controller';
import {
  generateToken,
  listTokens,
  revokeToken,
  deleteToken,
} from '../controllers/token.controller';
import { ensureDomainExists } from '../middleware/domainValidator';
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

// Event routes - specific routes must come before parameterized routes
// Event queue management routes (specific paths)
router.get('/event/users', adminReadLimiter, validate(eventUsersSchema), asyncHandler(getQueueUsers));
router.post('/event/start', adminWriteLimiter, validate(startQueueSchema), asyncHandler(startQueue));
router.post('/event/stop', adminWriteLimiter, validate(stopQueueSchema), asyncHandler(stopQueue));
router.post('/event/enqueue', adminWriteLimiter, validate(enqueueUserSchema), asyncHandler(enqueueUserAdmin));
router.post('/event/enqueue-batch', adminWriteLimiter, validate(enqueueBatchSchema), asyncHandler(enqueueBatch));
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

// Event CRUD routes (parameterized routes come after specific routes)
router.post(
  '/event',
  adminWriteLimiter,
  validate(createEventSchema),
  ensureDomainExists,
  asyncHandler(createEvent)
);
router.post('/event/:id/advance', adminWriteLimiter, validate(eventIdSchema), asyncHandler(advanceQueueManually));
router.put(
  '/event/:id',
  adminWriteLimiter,
  validate(updateEventSchema),
  asyncHandler(updateEvent)
);
router.delete(
  '/event/:id',
  adminWriteLimiter,
  validate(eventIdSchema),
  asyncHandler(deleteEvent)
);

// Token management routes
router.post(
  '/token',
  adminWriteLimiter,
  validate(generateTokenSchema),
  asyncHandler(generateToken)
);
router.get('/token', adminReadLimiter, asyncHandler(listTokens));
router.post(
  '/token/:id/revoke',
  adminWriteLimiter,
  validate(revokeTokenSchema),
  asyncHandler(revokeToken)
);
router.delete(
  '/token/:id',
  adminWriteLimiter,
  validate(tokenIdSchema),
  asyncHandler(deleteToken)
);

export default router;

