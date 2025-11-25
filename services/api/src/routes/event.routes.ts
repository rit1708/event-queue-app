import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validator';
import {
  createEventSchema,
  updateEventSchema,
  eventIdSchema,
} from '../schemas/event.schema';
import {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
} from '../controllers/event.controller';
import { ensureDomainExists } from '../middleware/domainValidator';

const router = Router();

router.get('/', asyncHandler(getEvents));
router.get('/:id', validate(eventIdSchema), asyncHandler(getEvent));
router.post('/', validate(createEventSchema), ensureDomainExists, asyncHandler(createEvent));
router.put('/:id', validate(updateEventSchema), asyncHandler(updateEvent));
router.delete('/:id', validate(eventIdSchema), asyncHandler(deleteEvent));

export default router;

