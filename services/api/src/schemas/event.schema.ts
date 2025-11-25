import { z } from 'zod';

export const createEventSchema = z.object({
  body: z.object({
    domain: z.string().min(1, 'Domain is required'),
    name: z.string().min(1, 'Event name is required').max(200),
    queueLimit: z.number().int().positive().max(1000).default(2),
    intervalSec: z.number().int().positive().max(3600).default(30),
  }),
});

export const updateEventSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid event ID format'),
  }),
  body: z.object({
    queueLimit: z.number().int().positive().max(1000).optional(),
    intervalSec: z.number().int().positive().max(3600).optional(),
    isActive: z.boolean().optional(),
    name: z.string().min(1).max(200).optional(),
  }),
});

export const eventIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid event ID format'),
  }),
});

export const joinQueueSchema = z.object({
  body: z.object({
    eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid event ID format'),
    userId: z.string().min(1, 'User ID is required').max(200),
  }),
});

export const queueStatusSchema = z.object({
  query: z.object({
    eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid event ID format'),
    userId: z.string().min(1, 'User ID is required').max(200),
  }),
});

export const createDomainSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Domain name is required').max(100),
  }),
});

export const eventUsersSchema = z.object({
  query: z.object({
    eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid event ID format'),
  }),
});

export const enqueueUserSchema = z.object({
  body: z.object({
    eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid event ID format'),
    userId: z.string().min(1, 'User ID is required').max(200),
  }),
});

export const enqueueBatchSchema = z.object({
  body: z.object({
    eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid event ID format'),
    count: z.number().int().positive().max(50).default(1),
  }),
});

export const startQueueSchema = z.object({
  body: z.object({
    eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid event ID format'),
  }),
});

export const stopQueueSchema = z.object({
  body: z.object({
    eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid event ID format'),
  }),
});
