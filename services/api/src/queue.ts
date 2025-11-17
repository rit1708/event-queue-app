import Redis, { RedisOptions } from 'ioredis';
import { getDb } from './mongo';

let redisClient: Redis | null = null;
let redisErrorLogged = false;
let redisConnected = false;

export async function getRedis(): Promise<Redis> {
  if (redisClient && redisConnected) return redisClient;
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

  const options: RedisOptions = {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    connectTimeout: 5000,
    retryStrategy(times) {
      if (times >= 3) return null;
      return Math.min(200 * times, 1000);
    },
    reconnectOnError: (err: Error) => {
      // Only reconnect on certain errors
      const targetError = 'READONLY';
      return err.message.includes(targetError);
    },
    lazyConnect: true, // Don't connect immediately
  };

  redisClient = new Redis(url, options);

  redisClient.on('error', (err: any) => {
    redisConnected = false;
    if (!redisErrorLogged) {
      redisErrorLogged = true;
      console.error('[redis] connection error:', err?.message || err);
    }
  });

  redisClient.on('connect', () => {
    redisConnected = true;
    redisErrorLogged = false;
    console.log('[redis] Connected successfully');
  });

  redisClient.on('ready', () => {
    redisConnected = true;
    redisErrorLogged = false;
  });

  redisClient.on('close', () => {
    redisConnected = false;
  });

  // Try to connect, but don't fail if it doesn't work
  try {
    await redisClient.connect();
  } catch (err: any) {
    // Connection failed, but we'll return the client anyway
    // It will be handled gracefully in the functions that use it
    console.warn(
      '[redis] Initial connection failed, will retry on use:',
      err?.message || err
    );
  }

  return redisClient;
}

export async function isRedisConnected(): Promise<boolean> {
  try {
    const redis = await getRedis();
    if (!redisConnected) return false;
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

function keys(eventId: string) {
  return {
    waiting: `q:${eventId}:waiting`,
    active: `q:${eventId}:active`,
    timer: `q:${eventId}:timer`,
    userset: `q:${eventId}:users`,
  };
}

export async function ensureEventKeys(redis: Redis, eventId: string) {
  try {
    if (!redisConnected) {
      try {
        await redis.connect();
        redisConnected = true;
      } catch (connectErr) {
        throw new Error('Redis connection not available');
      }
    }
    await redis.ping();
  } catch (err) {
    // Redis not available, but don't throw - let the calling code handle it
    throw new Error('Redis connection not available');
  }
}

export async function enqueueUser(
  redis: Redis,
  eventId: string,
  userId: string
) {
  try {
    if (!redisConnected) {
      try {
        await redis.connect();
        redisConnected = true;
      } catch (connectErr) {
        throw new Error('Redis connection not available');
      }
    }
    const k = keys(eventId);
    const added = await redis.sadd(k.userset, userId);
    if (added) {
      await redis.rpush(k.waiting, userId);
    }
  } catch (err) {
    throw new Error(
      'Redis operation failed: ' +
        (err instanceof Error ? err.message : String(err))
    );
  }
}

export async function advanceQueue(
  redis: Redis,
  eventId: string,
  limit: number,
  intervalSec: number
) {
  // Check connection status
  if (!redisConnected) {
    try {
      await redis.connect();
      redisConnected = true;
    } catch {
      // Redis not available, skip queue advancement
      return;
    }
  }

  try {
    const k = keys(eventId);
    const [ttl, activeLenInitial, waitingLenInitial] = await Promise.all([
      redis.ttl(k.timer),
      redis.llen(k.active),
      redis.llen(k.waiting),
    ]);

    // If current window is full and timer expired
    if (activeLenInitial >= limit && ttl <= 0) {
      // Start a new timer
      await redis.set(k.timer, '1', 'EX', intervalSec);
      // Don't return here - let the code continue to process waiting users
    }

    // Calculate available slots
    // If timer expired, we can take up to 'limit' users (replacing the batch)
    // Otherwise, just fill available slots up to the limit
    const slots = ttl <= 0 ? limit : Math.max(0, limit - activeLenInitial);
    if (slots === 0 || waitingLenInitial === 0) return;
    const moved: string[] = [];
    for (let i = 0; i < slots; i++) {
      const user = await redis.lpop(k.waiting);
      if (!user) break;
      moved.push(user);
    }
    if (moved.length > 0) {
      await redis.rpush(k.active, ...moved);
      // Log entries to Mongo
      try {
        const db = await getDb();
        await db
          .collection('entries')
          .insertMany(
            moved.map((u) => ({ eventId, userId: u, enteredAt: new Date() }))
          );
      } catch {}
      const newActiveLen = activeLenInitial + moved.length;
      if (newActiveLen >= limit || ttl <= 0) {
        // Start or refresh the window when we reach capacity or the timer expired
        await redis.set(k.timer, '1', 'EX', intervalSec);
      }
    }
  } catch (err) {
    // Redis operation failed, but don't throw - just log and continue
    console.warn(
      '[queue] advanceQueue error:',
      err instanceof Error ? err.message : String(err)
    );
  }
}

export async function getStatus(redis: Redis, eventId: string, userId: string) {
  // Check connection status
  if (!redisConnected) {
    try {
      await redis.connect();
      redisConnected = true;
    } catch {
      // Redis not available, return default status
      return {
        state: 'waiting' as const,
        position: 0,
        total: 0,
        timeRemaining: 0,
        activeUsers: 0,
        waitingUsers: 0,
      };
    }
  }

  try {
    const k = keys(eventId);
    const [active, waiting, ttl] = await Promise.all([
      redis.lrange(k.active, 0, -1),
      redis.lrange(k.waiting, 0, -1),
      redis.ttl(k.timer),
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
    const position = idx === -1 ? waiting.length : idx + 1;

    return {
      state: 'waiting',
      position,
      total: activeUsers + waitingUsers,
      timeRemaining,
      activeUsers,
      waitingUsers,
    };
  } catch (err) {
    // Redis operation failed, return default status
    return {
      state: 'waiting' as const,
      position: 0,
      total: 0,
      timeRemaining: 0,
      activeUsers: 0,
      waitingUsers: 0,
    };
  }
}
