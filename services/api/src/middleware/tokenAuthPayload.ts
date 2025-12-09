import { Request, Response, NextFunction } from 'express';
import { validateToken } from '../controllers/token.controller';
import { AppError } from '../utils/errors';

/**
 * Middleware to validate API token from request payload (body)
 * Token should be in req.body.token
 * This is used for join queue endpoint where token is sent in payload
 */
export const tokenAuthPayload = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.body?.token;
    
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      console.log('[tokenAuthPayload] No token found in payload');
      throw new AppError('Token is required in request body', 401, 'UNAUTHORIZED');
    }

    // Trim whitespace to prevent issues
    const trimmedToken = token.trim();

    console.log('[tokenAuthPayload] Validating token from payload:', trimmedToken.substring(0, 10) + '...');
    const isValid = await validateToken(trimmedToken);
    
    if (!isValid) {
      console.log('[tokenAuthPayload] Token validation failed');
      throw new AppError('Invalid or expired token', 401, 'UNAUTHORIZED');
    }
    
    console.log('[tokenAuthPayload] Token validated successfully');
    // Store token in request for potential future use
    (req as any).token = trimmedToken;
    
    next();
  } catch (error) {
    next(error);
  }
};

