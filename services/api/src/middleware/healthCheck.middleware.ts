import { Request, Response } from 'express';
import { getDb } from '../database/mongo';
import { getRedis } from '../database/redis';

export const healthCheck = async (req: Request, res: Response) => {
  try {
    // Check MongoDB
    let mongoStatus = false;
    try {
      const db = await getDb();
      await db.admin().ping();
      mongoStatus = true;
    } catch (error) {
      mongoStatus = false;
    }

    // Check Redis
    let redisStatus = false;
    try {
      const redis = await getRedis();
      await redis.ping();
      redisStatus = redis.status === 'ready';
    } catch (error) {
      redisStatus = false;
    }

    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoStatus ? 'connected' : 'disconnected',
        redis: redisStatus ? 'connected' : 'disconnected',
      },
    };

    const isHealthy = mongoStatus && redisStatus;
    res.status(isHealthy ? 200 : 503).json(status);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
};

export const readinessCheck = async (req: Request, res: Response) => {
  try {
    // Check MongoDB
    let mongoStatus = false;
    try {
      const db = await getDb();
      await db.admin().ping();
      mongoStatus = true;
    } catch (error) {
      mongoStatus = false;
    }

    // Check Redis
    let redisStatus = false;
    try {
      const redis = await getRedis();
      await redis.ping();
      redisStatus = redis.status === 'ready';
    } catch (error) {
      redisStatus = false;
    }

    if (mongoStatus && redisStatus) {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({
        status: 'not ready',
        services: {
          mongodb: mongoStatus ? 'ready' : 'not ready',
          redis: redisStatus ? 'ready' : 'not ready',
        },
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: 'Readiness check failed',
    });
  }
};
