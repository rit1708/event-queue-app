import { Request, Response, NextFunction } from 'express';
import { validateToken } from '../controllers/token.controller';
import { AppError } from '../utils/errors';

/**
 * Middleware to validate API token from Authorization header
 * Token should be in format: Bearer <token> or just <token>
 */
export const tokenAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new AppError('Authorization token required', 401, 'UNAUTHORIZED');
    }

    // Extract token from "Bearer <token>" or just "<token>"
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    if (!token) {
      throw new AppError('Invalid authorization header format', 401, 'UNAUTHORIZED');
    }

    const isValid = await validateToken(token);
    
    if (!isValid) {
      throw new AppError('Invalid or expired token', 401, 'UNAUTHORIZED');
    }

    // Store token in request for potential future use
    (req as any).token = token;
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional token authentication - doesn't fail if token is missing
 * Useful for endpoints that work with or without authentication
 */
export const optionalTokenAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : authHeader;

      if (token) {
        const isValid = await validateToken(token);
        if (isValid) {
          (req as any).token = token;
        }
      }
    }
    
    next();
  } catch (error) {
    // Don't fail on optional auth errors, just continue
    next();
  }
};

