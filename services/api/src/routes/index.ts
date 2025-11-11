import { Router } from 'express';
import { DomainController } from '../controllers/DomainController';
import { EventController } from '../controllers/EventController';
import { QueueController } from '../controllers/QueueController';
import {
  validate,
  createDomainSchema,
  createEventSchema,
  updateEventSchema,
  joinQueueSchema,
  queueStatusQuerySchema,
  eventIdSchema,
  enqueueBatchSchema,
} from '../validators';

export function createRoutes(
  domainController: DomainController,
  eventController: EventController,
  queueController: QueueController
): Router {
  const router = Router();

  // Domain routes
  router.post('/admin/domain', validate(createDomainSchema), domainController.create);
  router.get('/admin/domains', domainController.getAll);
  router.get('/admin/domain/:id', validate(eventIdSchema), domainController.getById);
  router.delete('/admin/domain/:id', validate(eventIdSchema), domainController.delete);

  // Event routes
  router.get('/events', eventController.getAll);
  router.get('/events/:id', validate(eventIdSchema), eventController.getById);
  router.post('/admin/event', validate(createEventSchema), eventController.create);
  router.put('/admin/event/:id', validate(eventIdSchema), validate(updateEventSchema), eventController.update);
  router.delete('/admin/event/:id', validate(eventIdSchema), eventController.delete);

  // Queue routes
  router.post('/queue/join', validate(joinQueueSchema), queueController.join);
  router.get('/queue/status', validate(queueStatusQuerySchema), queueController.getStatus);
  router.get('/admin/event/users', queueController.getQueueData);
  router.post('/admin/event/:id/advance', validate(eventIdSchema), queueController.advance);
  router.post('/admin/event/enqueue-batch', validate(enqueueBatchSchema), queueController.enqueueBatch);
  router.get('/admin/event/entries', queueController.getEntryHistory);
  router.post('/admin/event/enqueue', validate(joinQueueSchema), queueController.join);
  router.post('/admin/event/start', queueController.start);
  router.post('/admin/event/stop', queueController.stop);

  return router;
}

