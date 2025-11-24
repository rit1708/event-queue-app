import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { getEnv } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { logger } from './utils/logger';
import { getDb } from './db/mongo';
import { getRedis } from './db/queue';
import { schedulerTick } from './services/scheduler.service';
import eventRoutes from './routes/event.routes';
import queueRoutes from './routes/queue.routes';
import adminRoutes from './routes/admin.routes';

const env = getEnv();

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const corsOptions = {
  origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(requestLogger);

app.get('/', (_req: Request, res: Response) => {
  res.json({ 
    ok: true, 
    service: 'queue-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

import { apiLimiter } from './middleware/rateLimiter';

const apiRouter = express.Router();
apiRouter.use(apiLimiter);

apiRouter.get('/health', async (_req: Request, res: Response) => {
  const health = {
    ok: true,
    timestamp: new Date().toISOString(),
    services: {
      mongodb: false,
      redis: false,
    },
  };

  try {
    await getDb();
    health.services.mongodb = true;
  } catch (e) {
    health.ok = false;
  }

  try {
    const { isRedisConnected } = await import('./db/queue');
    health.services.redis = await isRedisConnected();
    if (!health.services.redis) {
      health.ok = false;
    }
  } catch (e) {
    health.ok = false;
  }

  res.status(health.ok ? 200 : 503).json(health);
});

apiRouter.get('/sdk', async (_req: Request, res: Response) => {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const sdkPath = path.join(
      process.cwd(),
      '..',
      '..',
      'packages',
      'sdk',
      'dist',
      'index.js'
    );
    
    try {
      const sdkContent = await fs.readFile(sdkPath, 'utf-8');
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(sdkContent);
    } catch (error) {
      res.status(404).json({
        error: 'SDK not found. Please build the SDK first: cd packages/sdk && npm run build',
      });
    }
  } catch (error) {
    logger.error('Error serving SDK', error instanceof Error ? error : undefined);
    res.status(500).json({ error: 'Failed to serve SDK' });
  }
});

apiRouter.use('/events', eventRoutes);
apiRouter.use('/queue', queueRoutes);
apiRouter.use('/admin', adminRoutes);

app.use('/api', apiRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'NOT_FOUND',
  });
});

app.use(errorHandler);

setInterval(schedulerTick, 1000);
logger.info('Scheduler started (runs every 1 second)');

const PORT = env.PORT;
app.listen(PORT, '0.0.0.0', async () => {
  logger.info(`🚀 Server starting on port ${PORT}...`);

  try {
    await getDb();
    logger.info('✅ MongoDB connected');
  } catch (e) {
    logger.error('❌ MongoDB connection failed', e instanceof Error ? e : undefined);
  }

  try {
    await getRedis();
    logger.info('✅ Redis connected');
  } catch (e) {
    logger.warn('⚠️  Redis connection failed (queue features may be limited)', {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  logger.info(`✅ API listening on http://0.0.0.0:${PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
