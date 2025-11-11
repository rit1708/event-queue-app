import Redis from 'ioredis';
import { getDb } from './mongo';
import logger from '../config/logger';

export interface QueueKeys {
  waiting: string;
  active: string;
  timer: string;
  userset: string;
}

export function getQueueKeys(eventId: string): QueueKeys {
  return {
    waiting: `q:${eventId}:waiting`,
    active: `q:${eventId}:active`,
    timer: `q:${eventId}:timer`,
    userset: `q:${eventId}:users`,
  };
}

export async function ensureEventKeys(redis: Redis, eventId: string): Promise<void> {
  try {
    await redis.ping();
  } catch (error) {
    logger.error('Redis ping failed:', error);
    throw error;
  }
}

export async function enqueueUser(redis: Redis, eventId: string, userId: string): Promise<boolean> {
  const keys = getQueueKeys(eventId);
  
  try {
    // Use SET to ensure user is only added once
    const added = await redis.sadd(keys.userset, userId);
    if (added) {
      await redis.rpush(keys.waiting, userId);
      logger.debug('User enqueued', { eventId, userId });
      return true;
    }
    logger.debug('User already in queue', { eventId, userId });
    return false;
  } catch (error) {
    logger.error('Failed to enqueue user:', error);
    throw error;
  }
}

export async function advanceQueue(
  redis: Redis,
  eventId: string,
  limit: number,
  intervalSec: number
): Promise<string[]> {
  const keys = getQueueKeys(eventId);
  
  try {
    const [ttl, activeLen, waitingLen] = await Promise.all([
      redis.ttl(keys.timer),
      redis.llen(keys.active),
      redis.llen(keys.waiting),
    ]);

    // If current window is full and timer expired, start a new timer
    if (activeLen >= limit && ttl <= 0) {
      await redis.set(keys.timer, '1', 'EX', intervalSec);
    }

    // Calculate available slots
    const slots = ttl <= 0 ? limit : Math.max(0, limit - activeLen);
    if (slots === 0 || waitingLen === 0) {
      return [];
    }

    const moved: string[] = [];
    for (let i = 0; i < slots; i++) {
      const user = await redis.lpop(keys.waiting);
      if (!user) break;
      moved.push(user);
    }

    if (moved.length > 0) {
      await redis.rpush(keys.active, ...moved);
      
      // Log entries to MongoDB
      try {
        const db = await getDb();
        await db.collection('entries').insertMany(
          moved.map((userId) => ({
            eventId,
            userId,
            enteredAt: new Date(),
          }))
        );
      } catch (error) {
        logger.error('Failed to log queue entries to MongoDB:', error);
        // Don't throw - queue advancement should continue even if logging fails
      }

      const newActiveLen = activeLen + moved.length;
      if (newActiveLen >= limit || ttl <= 0) {
        await redis.set(keys.timer, '1', 'EX', intervalSec);
      }

      logger.debug('Queue advanced', {
        eventId,
        moved: moved.length,
        active: newActiveLen,
        waiting: waitingLen - moved.length,
      });
    }

    return moved;
  } catch (error) {
    logger.error('Failed to advance queue:', error);
    throw error;
  }
}

export async function getQueueStatus(
  redis: Redis,
  eventId: string,
  userId: string
): Promise<{
  state: 'waiting' | 'active' | 'not_queued';
  position: number;
  total: number;
  timeRemaining: number;
  activeUsers: number;
  waitingUsers: number;
}> {
  const keys = getQueueKeys(eventId);
  
  try {
    const [active, waiting, ttl] = await Promise.all([
      redis.lrange(keys.active, 0, -1),
      redis.lrange(keys.waiting, 0, -1),
      redis.ttl(keys.timer),
    ]);

    const activeUsers = active.length;
    const waitingUsers = waiting.length;
    const timeRemaining = Math.max(0, ttl);

    const inActive = active.indexOf(userId);
    if (inActive !== -1) {
      return {
        state: 'active',
        position: 0,
        total: activeUsers + waitingUsers,
        timeRemaining,
        activeUsers,
        waitingUsers,
      };
    }

    const idx = waiting.indexOf(userId);
    if (idx === -1) {
      return {
        state: 'not_queued',
        position: 0,
        total: activeUsers + waitingUsers,
        timeRemaining,
        activeUsers,
        waitingUsers,
      };
    }

    return {
      state: 'waiting',
      position: idx + 1,
      total: activeUsers + waitingUsers,
      timeRemaining,
      activeUsers,
      waitingUsers,
    };
  } catch (error) {
    logger.error('Failed to get queue status:', error);
    throw error;
  }
}

export async function getQueueData(redis: Redis, eventId: string): Promise<{
  active: string[];
  waiting: string[];
  remaining: number;
}> {
  const keys = getQueueKeys(eventId);
  
  try {
    const [active, waiting, ttl] = await Promise.all([
      redis.lrange(keys.active, 0, -1),
      redis.lrange(keys.waiting, 0, -1),
      redis.ttl(keys.timer),
    ]);

    return {
      active,
      waiting,
      remaining: Math.max(0, ttl),
    };
  } catch (error) {
    logger.error('Failed to get queue data:', error);
    throw error;
  }
}

export async function clearQueue(redis: Redis, eventId: string): Promise<void> {
  const keys = getQueueKeys(eventId);
  
  try {
    await Promise.all([
      redis.del(keys.active),
      redis.del(keys.waiting),
      redis.del(keys.timer),
      redis.del(keys.userset),
    ]);
    logger.info('Queue cleared', { eventId });
  } catch (error) {
    logger.error('Failed to clear queue:', error);
    throw error;
  }
}

