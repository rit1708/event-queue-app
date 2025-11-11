import { z } from 'zod';
import { ValidationError } from '../errors/AppError';

export const createDomainSchema = z.object({
  name: z.string().min(1).max(255).trim(),
});

export const createEventSchema = z.object({
  domain: z.string().min(1).max(255).trim(),
  name: z.string().min(1).max(255).trim(),
  queueLimit: z.number().int().positive().max(100),
  intervalSec: z.number().int().positive().max(3600),
});

export const updateEventSchema = z.object({
  queueLimit: z.number().int().positive().max(100).optional(),
  intervalSec: z.number().int().positive().max(3600).optional(),
  isActive: z.boolean().optional(),
});

export const joinQueueSchema = z.object({
  eventId: z.string().min(1),
  userId: z.string().min(1),
});

export const queueStatusQuerySchema = z.object({
  eventId: z.string().min(1),
  userId: z.string().min(1),
});

export const eventIdSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid event ID format'),
});

export const enqueueBatchSchema = z.object({
  eventId: z.string().min(1),
  count: z.number().int().positive().max(50),
});

export const validate = <T>(schema: z.ZodSchema<T>) => {
  return (req: any, res: any, next: any) => {
    try {
      // Try to validate body, query, or params based on what's available
      let dataToValidate: any;
      if (req.body && Object.keys(req.body).length > 0) {
        dataToValidate = req.body;
      } else if (req.query && Object.keys(req.query).length > 0) {
        dataToValidate = req.query;
      } else if (req.params && Object.keys(req.params).length > 0) {
        dataToValidate = req.params;
      } else {
        dataToValidate = {};
      }

      req.validated = schema.parse(dataToValidate);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        }));
        throw new ValidationError(`Validation failed: ${errors.map((e) => e.message).join(', ')}`);
      }
      next(error);
    }
  };
};
