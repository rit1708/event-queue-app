import { Request, Response, NextFunction } from 'express';
import { validateDomainAndEventFromRequest } from '../services/validation.service';
import { ValidationError, NotFoundError } from '../utils/errors';

declare module 'express-serve-static-core' {
  interface Locals {
    validatedDomain?: {
      _id: string;
      name: string;
      createdAt?: Date;
    };
    validatedEvent?: {
      _id: string;
      name: string;
      domain: string;
      queueLimit: number;
      intervalSec: number;
      isActive: boolean;
      createdAt?: Date;
      updatedAt?: Date;
    };
  }
}

/**
 * Middleware to validate domain and event before allowing queue operations
 * Validates:
 * - Domain exists
 * - Event exists
 * - Event belongs to the domain
 * 
 * On success, stores validated domain and event in res.locals
 * On failure, returns appropriate error response
 */
export const validateQueueAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validationResult = await validateDomainAndEventFromRequest(req);

    if (!validationResult.isValid) {
      // Map error codes to appropriate HTTP errors
      if (validationResult.errorCode === 'DOMAIN_NOT_FOUND' || validationResult.errorCode === 'DOMAIN_REQUIRED') {
        throw new ValidationError(validationResult.error || 'Domain not validated');
      }
      
      if (validationResult.errorCode === 'EVENT_NOT_FOUND') {
        throw new NotFoundError('Event', req.body?.eventId || req.query?.eventId);
      }

      // Default validation error
      throw new ValidationError(validationResult.error || 'Validation failed');
    }

    // Store validated data in res.locals for use in controllers
    if (validationResult.domain) {
      res.locals.validatedDomain = validationResult.domain;
    }
    if (validationResult.event) {
      res.locals.validatedEvent = validationResult.event;
    }

    next();
  } catch (error) {
    next(error);
  }
};

