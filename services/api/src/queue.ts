import Redis from 'ioredis';
import { getDb } from './mongo';

let redisClient: Redis | null = null;

export async function getRedis(): Promise<Redis> {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  redisClient = new Redis(url);
  return redisClient;
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
  await redis.ping();
}

export async function enqueueUser(redis: Redis, eventId: string, userId: string) {
  const k = keys(eventId);
  const added = await redis.sadd(k.userset, userId);
  if (added) {
    await redis.rpush(k.waiting, userId);
  }
}

export async function advanceQueue(redis: Redis, eventId: string, limit: number, intervalSec: number) {
  const k = keys(eventId);
  const [ttl, activeLenInitial, waitingLenInitial] = await Promise.all([
    redis.ttl(k.timer),
    redis.llen(k.active),
    redis.llen(k.waiting),
  ]);

  // If current window is full
  if (activeLenInitial >= limit) {
    // If window expired, rotate to next batch
    if (ttl <= 0) {
      await redis.del(k.active);
      const moved: string[] = [];
      for (let i = 0; i < limit; i++) {
        const user = await redis.lpop(k.waiting);
        if (!user) break;
        moved.push(user);
      }
      if (moved.length > 0) {
        await redis.rpush(k.active, ...moved);
        // Log entries to Mongo
        try {
          const db = await getDb();
          await db.collection('entries').insertMany(
            moved.map((u) => ({ eventId, userId: u, enteredAt: new Date() }))
          );
        } catch {}
        // Start a new window when we filled the batch or there are still waiters
        const remainingWaiting = await redis.llen(k.waiting);
        if (moved.length === limit || remainingWaiting > 0) {
          await redis.set(k.timer, '1', 'EX', intervalSec);
        }
      }
    }
    return;
  }

  // active < limit: Try to admit immediately if no timer running
  if (ttl > 0) {
    // Timer running while not full: keep behavior simple; do nothing
    return;
  }
  const slots = Math.max(0, limit - activeLenInitial);
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
      await db.collection('entries').insertMany(
        moved.map((u) => ({ eventId, userId: u, enteredAt: new Date() }))
      );
    } catch {}
    const newActiveLen = activeLenInitial + moved.length;
    if (newActiveLen >= limit) {
      // Start the window now that we've reached capacity
      await redis.set(k.timer, '1', 'EX', intervalSec);
    }
  }
}

export async function getStatus(redis: Redis, eventId: string, userId: string) {
  const k = keys(eventId);
  const [active, waiting, ttl] = await Promise.all([
    redis.lrange(k.active, 0, -1),
    redis.lrange(k.waiting, 0, -1),
    redis.ttl(k.timer),
  ]);
  const inActive = active.indexOf(userId);
  if (inActive !== -1) {
    return { state: 'active', position: 0, remaining: Math.max(0, ttl) };
  }
  const idx = waiting.indexOf(userId);
  return { state: 'waiting', position: idx === -1 ? waiting.length : idx + 1, remaining: Math.max(0, ttl) };
}
