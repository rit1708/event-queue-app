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
      console.log('[tokenAuth] No Authorization header found');
      throw new AppError('Authorization token required', 401, 'UNAUTHORIZED');
    }

    // Extract token from "Bearer <token>" or just "<token>"
    let token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    // Trim whitespace to prevent issues
    token = token.trim();

    if (!token) {
      console.log('[tokenAuth] Token is empty after extraction');
      throw new AppError('Invalid authorization header format', 401, 'UNAUTHORIZED');
    }

    console.log('[tokenAuth] Validating token:', token.substring(0, 10) + '...');
    const isValid = await validateToken(token);
    
    if (!isValid) {
      console.log('[tokenAuth] Token validation failed for:', token.substring(0, 10) + '...');
      throw new AppError('Invalid or expired token', 401, 'UNAUTHORIZED');
    }
    
    console.log('[tokenAuth] Token validated successfully');

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

