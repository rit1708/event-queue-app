import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error
  if (err instanceof Error) {
    logger.error(`Error in ${req.method} ${req.path}`, err, {
      body: req.body,
      query: req.query,
      params: req.params,
    });
  } else {
    logger.error(`Unknown error in ${req.method} ${req.path}`, undefined, {
      error: err,
      body: req.body,
      query: req.query,
      params: req.params,
    });
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Handle custom AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
    return;
  }

  // Handle MongoDB ObjectId errors
  if (err instanceof Error && err.message.includes('ObjectId')) {
    res.status(400).json({
      success: false,
      error: 'Invalid ID format',
      code: 'INVALID_ID',
    });
    return;
  }

  // Handle MongoDB connection errors
  if (err instanceof Error) {
    const errorMessage = err.message.toLowerCase();
    if (
      errorMessage.includes('mongoserverselectionerror') ||
      errorMessage.includes('mongonetworkerror') ||
      errorMessage.includes('ssl') ||
      errorMessage.includes('connection')
    ) {
      res.status(503).json({
        success: false,
        error: 'Database service temporarily unavailable. Please try again later.',
        code: 'DATABASE_UNAVAILABLE',
      });
      return;
    }
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err instanceof Error ? err.message : 'Unknown error occurred',
    code: 'INTERNAL_ERROR',
  });
};

