import { getDb } from '../db/mongo';
import { getRedis, advanceQueue, ensureEventKeys, isRedisConnected } from '../db/queue';
import { logger } from '../utils/logger';

let redisBackoffUntil = 0;
let redisWarningShown = false;
let mongoBackoffUntil = 0;
let mongoWarningShown = false;

export async function schedulerTick(): Promise<void> {
  try {
    const now = Date.now();
    if (now < redisBackoffUntil || now < mongoBackoffUntil) return;

    // Check MongoDB connection with backoff
    let db;
    try {
      db = await getDb();
    } catch (mongoErr) {
      if (!mongoWarningShown) {
        mongoWarningShown = true;
        logger.warn('MongoDB connection failed. Scheduler paused.', {
          error: mongoErr instanceof Error ? mongoErr.message : String(mongoErr),
          retryIn: '30 seconds',
        });
      }
      mongoBackoffUntil = now + 30000;
      return;
    }

    if (mongoWarningShown) {
      mongoWarningShown = false;
      logger.info('MongoDB connection restored');
    }
    mongoBackoffUntil = 0;

    // Get active events
    const events = await db
      .collection('events')
      .find({ isActive: true })
      .project({ _id: 1, queueLimit: 1, intervalSec: 1 })
      .toArray();

    if (events.length === 0) return;

    // Check Redis connection
    const redis = await getRedis();
    try {
      const connected = await isRedisConnected();
      if (!connected) {
        try {
          await redis.connect();
          redisWarningShown = false;
        } catch (connectErr) {
          // Connection failed, will retry later
        }
      }
      await redis.ping();
      redisWarningShown = false;
    } catch (e) {
      if (!redisWarningShown) {
        redisWarningShown = true;
        logger.warn('Redis not available. Queue advancement is disabled.', {
          hint: 'Start Redis: docker compose up redis or redis-server',
        });
      }
      redisBackoffUntil = now + 30000;
      return;
    }

    // Process each active event
    for (const e of events as any[]) {
      const eventId = String(e._id);
      try {
        const isConnected = await ensureEventKeys(redis, eventId);
        if (isConnected) {
          await advanceQueue(redis, eventId, e.queueLimit, e.intervalSec);
        }
      } catch (err) {
        logger.warn(`Failed to process event ${eventId}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    logger.error('Scheduler tick error', err instanceof Error ? err : undefined, {
      error: String(err),
    });
  }
}

