import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

type RateLimiterOptions = {
  windowMs: number;
  max: number;
  name?: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
};

type RateRecord = {
  count: number;
  resetTime: number;
  timeout: NodeJS.Timeout;
};

const createRateLimiter = (options: RateLimiterOptions) => {
  const { windowMs, max, name = 'rate', keyGenerator, skip } = options;
  const requests = new Map<string, RateRecord>();

  return (req: Request, res: Response, next: NextFunction): void => {
    if (skip?.(req)) {
      return next();
    }

    const key =
      keyGenerator?.(req) || req.ip || req.socket.remoteAddress || 'unknown';

    const now = Date.now();
    let record = requests.get(key);

    if (!record || now > record.resetTime) {
      if (record?.timeout) {
        clearTimeout(record.timeout);
      }

      const resetTime = now + windowMs;
      const timeout = setTimeout(() => {
        requests.delete(key);
      }, windowMs);

      record = { count: 0, resetTime, timeout };
      requests.set(key, record);
    }

    const nextCount = record.count + 1;
    const remaining = Math.max(max - nextCount, 0);
    const resetInSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(remaining, 0)));
    res.setHeader(
      'X-RateLimit-Reset',
      String(Math.floor(record.resetTime / 1000))
    );

    if (nextCount > max) {
      res.setHeader('Retry-After', String(resetInSeconds));
      logger.warn(`${name} limit exceeded`, { key, path: req.path });
      res.status(429).json({
        success: false,
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: resetInSeconds,
      });
      return;
    }

    record.count = nextCount;
    next();
  };
};

export const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 600,
  name: 'api',
});

export const queueJoinLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  name: 'queue-join',
});

export const queueStatusLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 180,
  name: 'queue-status',
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const eventId =
      typeof req.query.eventId === 'string' ? req.query.eventId : '';
    const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
    return `${ip}:${eventId}:${userId}`;
  },
});

export const adminWriteLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  name: 'admin-write',
});

export const adminReadLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 240,
  name: 'admin-read',
});
