import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo';
import {
  getRedis,
  advanceQueue,
  enqueueUser,
  getStatus,
  ensureEventKeys,
} from '../db/queue';
import { NotFoundError, RedisError } from '../utils/errors';
import { QueueStatus, QueueUsers, Event } from '../types';

// Helper function to generate Redis keys
function keys(eventId: string) {
  return {
    waiting: `q:${eventId}:waiting`,
    active: `q:${eventId}:active`,
    timer: `q:${eventId}:timer`,
    userset: `q:${eventId}:users`,
  };
}

export const joinQueue = async (req: Request, res: Response): Promise<void> => {
  const { eventId, userId } = req.body;
  const db = await getDb();

  // Use validated event from middleware if available, otherwise fetch it
  let event: Event = res.locals.validatedEvent as Event;
  if (!event) {
    // Fallback: verify event exists (shouldn't happen if middleware is working)
    const eventDoc = await db
      .collection('events')
      .findOne({ _id: new ObjectId(eventId) });
    if (!eventDoc) {
      throw new NotFoundError('Event', eventId);
    }
    event = {
      _id: String(eventDoc._id),
      name: eventDoc.name,
      domain: eventDoc.domain,
      queueLimit: eventDoc.queueLimit,
      intervalSec: eventDoc.intervalSec,
      isActive: eventDoc.isActive || false,
      createdAt: eventDoc.createdAt,
      updatedAt: eventDoc.updatedAt,
    };
  }

  const redis = await getRedis();
  const isConnected = await ensureEventKeys(redis, eventId);

  if (!isConnected) {
    throw new RedisError(
      'Queue service temporarily unavailable. Please try again later.'
    );
  }

  // Check current queue status
  const status = await getStatus(redis, eventId, userId);

  // If user is already active, return active status
  if (status.state === 'active') {
    res.json({
      success: true,
      status: 'active',
      state: 'active',
      ...status,
      showWaitingTimer: false,
    });
    return;
  }

  // Check entry window availability (Entry Timer Logic)
  const k = keys(eventId);
  const [ttl, activeLen, waitingLen] = await Promise.all([
    redis.ttl(k.timer),
    redis.llen(k.active),
    redis.llen(k.waiting),
  ]);

  const entryWindowActive = ttl > 0; // Entry timer is running
  const hasAvailableSlots = activeLen < event.queueLimit; // Not at capacity
  const canEnterDirectly = !entryWindowActive || hasAvailableSlots; // Can enter if timer expired OR slots available

  // If user is not in queue and can enter directly
  if (status.state !== 'waiting' && canEnterDirectly) {
    // Add user directly to active queue
    await redis.sadd(k.userset, userId);
    await redis.rpush(k.active, userId);

    // If this fills the queue or timer was expired, start/refresh entry timer
    const newActiveLen = activeLen + 1;
    if (newActiveLen >= event.queueLimit || !entryWindowActive) {
      await redis.set(k.timer, '1', 'EX', event.intervalSec);
    }

    // Log entry to Mongo
    try {
      await db
        .collection('entries')
        .insertOne({ eventId, userId, enteredAt: new Date() });
    } catch {}

    // Get updated status
    const updatedStatus = await getStatus(redis, eventId, userId);
    res.json({
      success: true,
      status: 'active',
      state: 'active',
      ...updatedStatus,
      showWaitingTimer: false, // No waiting timer needed - entered directly
    });
    return;
  }

  // If user is not in queue but cannot enter directly (entry window full)
  if (status.state !== 'waiting' && !canEnterDirectly) {
    // Add user to waiting queue
    await enqueueUser(redis, eventId, userId);

    // Get updated status
    const updatedStatus = await getStatus(redis, eventId, userId);
    res.json({
      success: true,
      status: 'waiting',
      state: 'waiting',
      ...updatedStatus,
      showWaitingTimer: true, // Show 45-second waiting timer
      waitingTimerDuration: 45, // 45 seconds
    });
    return;
  }

  // If user is already in waiting queue
  if (status.state === 'waiting') {
    // Check if they can be moved to active now
    await advanceQueue(redis, eventId, event.queueLimit, event.intervalSec);
    const updatedStatus = await getStatus(redis, eventId, userId);

    // Determine if waiting timer should be shown
    // Show timer only if entry window is active and at capacity
    const [updatedTtl, updatedActiveLen] = await Promise.all([
      redis.ttl(k.timer),
      redis.llen(k.active),
    ]);
    const entryWindowFull =
      updatedTtl > 0 && updatedActiveLen >= event.queueLimit;
    const shouldShowTimer =
      updatedStatus.state === 'waiting' && entryWindowFull;

    res.json({
      success: true,
      status: updatedStatus.state,
      state: updatedStatus.state,
      ...updatedStatus,
      showWaitingTimer: shouldShowTimer,
      waitingTimerDuration: shouldShowTimer ? 45 : 0,
    });
    return;
  }

  // Fallback: enqueue and advance
  await enqueueUser(redis, eventId, userId);
  await advanceQueue(redis, eventId, event.queueLimit, event.intervalSec);
  const updatedStatus = await getStatus(redis, eventId, userId);
  res.json({
    success: true,
    status: updatedStatus.state,
    state: updatedStatus.state,
    ...updatedStatus,
    showWaitingTimer: false,
  });
};

export const getQueueStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { eventId, userId } = req.query as { eventId: string; userId: string };
  const db = await getDb();

  // Verify event exists
  const event = await db
    .collection('events')
    .findOne({ _id: new ObjectId(eventId) });
  if (!event) {
    throw new NotFoundError('Event', eventId);
  }

  const redis = await getRedis();
  const isConnected = await ensureEventKeys(redis, eventId);

  if (!isConnected) {
    // Return default waiting status instead of error
    const defaultStatus: QueueStatus = {
      state: 'waiting',
      position: 0,
      total: 0,
      timeRemaining: 0,
      activeUsers: 0,
      waitingUsers: 0,
    };
    res.json({ ...defaultStatus, showWaitingTimer: false });
    return;
  }

  await advanceQueue(redis, eventId, event.queueLimit, event.intervalSec);
  const status = await getStatus(redis, eventId, userId);

  // Determine if waiting timer should be shown
  // Show timer only if user is waiting AND entry window is active and at capacity
  const k = keys(eventId);
  const [ttl, activeLen] = await Promise.all([
    redis.ttl(k.timer),
    redis.llen(k.active),
  ]);
  const entryWindowFull = ttl > 0 && activeLen >= event.queueLimit;
  const shouldShowTimer = status.state === 'waiting' && entryWindowFull;

  res.json({
    ...status,
    showWaitingTimer: shouldShowTimer,
    waitingTimerDuration: shouldShowTimer ? 45 : 0,
  });
};

export const getQueueUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { eventId } = req.query as { eventId: string };
  const db = await getDb();

  // Verify event exists
  const event = await db
    .collection('events')
    .findOne({ _id: new ObjectId(eventId) });
  if (!event) {
    throw new NotFoundError('Event', eventId);
  }

  const redis = await getRedis();
  const isConnected = await ensureEventKeys(redis, eventId);

  if (!isConnected) {
    // Return empty queue data instead of error
    const emptyQueue: QueueUsers = { active: [], waiting: [], remaining: 0 };
    res.json(emptyQueue);
    return;
  }

  // Advance queue to reflect current state
  await advanceQueue(redis, eventId, event.queueLimit, event.intervalSec);

  const kActive = `q:${eventId}:active`;
  const kWaiting = `q:${eventId}:waiting`;
  const kTimer = `q:${eventId}:timer`;

  const [active, waiting, ttl] = await Promise.all([
    redis.lrange(kActive, 0, -1),
    redis.lrange(kWaiting, 0, -1),
    redis.ttl(kTimer),
  ]);

  res.json({
    active,
    waiting,
    remaining: Math.max(0, ttl),
  });
};

export const advanceQueueManually = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const db = await getDb();

  // Verify event exists
  const event = await db
    .collection('events')
    .findOne({ _id: new ObjectId(id) });
  if (!event) {
    throw new NotFoundError('Event', id);
  }

  const redis = await getRedis();
  const isConnected = await ensureEventKeys(redis, id);

  if (!isConnected) {
    throw new RedisError('Redis service unavailable');
  }

  const kActive = `q:${id}:active`;
  const kWaiting = `q:${id}:waiting`;
  const kTimer = `q:${id}:timer`;

  // Clear active queue
  await redis.del(kActive);

  // Move users from waiting to active
  const moved: string[] = [];
  for (let i = 0; i < event.queueLimit; i++) {
    const user = await redis.lpop(kWaiting);
    if (!user) break;
    moved.push(user);
  }

  if (moved.length > 0) {
    await redis.rpush(kActive, ...moved);
    await redis.set(kTimer, '1', 'EX', event.intervalSec);
  } else {
    await redis.del(kTimer);
  }

  const [active, waiting] = await Promise.all([
    redis.lrange(kActive, 0, -1),
    redis.lrange(kWaiting, 0, -1),
  ]);

  res.json({
    success: true,
    moved,
    active,
    waiting,
  });
};

export const startQueue = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { eventId } = req.body;
  const db = await getDb();

  // Verify event exists
  const event = await db
    .collection('events')
    .findOne({ _id: new ObjectId(eventId) });
  if (!event) {
    throw new NotFoundError('Event', eventId);
  }

  const redis = await getRedis();
  // Try to connect if not connected, with multiple retry attempts
  let isConnected = await ensureEventKeys(redis, eventId);

  // Retry connection up to 3 times with delays
  if (!isConnected) {
    for (let attempt = 0; attempt < 3 && !isConnected; attempt++) {
      try {
        // Wait a bit before retry (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * (attempt + 1))
        );
        await redis.connect();
        isConnected = await ensureEventKeys(redis, eventId);
        if (isConnected) break;
      } catch (connectErr) {
        // Connection failed, will retry
        if (attempt === 2) {
          // Last attempt failed
          const errorMsg =
            connectErr instanceof Error
              ? connectErr.message
              : String(connectErr);
          throw new RedisError(
            `Redis service unavailable after 3 connection attempts. ` +
              `Error: ${errorMsg}. ` +
              `Please ensure Redis is running on ${process.env.REDIS_URL || 'redis://127.0.0.1:6379'}. ` +
              `Start Redis with: docker compose up redis -d (or redis-server for local install)`
          );
        }
      }
    }
  }

  if (!isConnected) {
    throw new RedisError(
      `Redis service unavailable. Please ensure Redis is running on ${process.env.REDIS_URL || 'redis://127.0.0.1:6379'}. ` +
        `Start Redis with: docker compose up redis -d (or redis-server for local install). ` +
        `Check health at: /api/health`
    );
  }

  const kActive = `q:${eventId}:active`;
  const kWaiting = `q:${eventId}:waiting`;
  const kTimer = `q:${eventId}:timer`;

  // Backfill at least one to active if empty
  let activeLen = await redis.llen(kActive);
  if (activeLen === 0) {
    const user = await redis.lpop(kWaiting);
    if (user) {
      await redis.rpush(kActive, user);
      activeLen = 1;
    }
  }

  if (activeLen > 0) {
    await redis.set(kTimer, '1', 'EX', event.intervalSec);
  }

  // Mark event as active
  await db
    .collection('events')
    .updateOne(
      { _id: new ObjectId(eventId) },
      { $set: { isActive: true, updatedAt: new Date() } }
    );

  res.json({ success: true });
};

export const stopQueue = async (req: Request, res: Response): Promise<void> => {
  const { eventId } = req.body;
  const db = await getDb();

  // Verify event exists
  const event = await db
    .collection('events')
    .findOne({ _id: new ObjectId(eventId) });
  if (!event) {
    throw new NotFoundError('Event', eventId);
  }

  const redis = await getRedis();
  const isConnected = await ensureEventKeys(redis, eventId);

  if (isConnected) {
    const kActive = `q:${eventId}:active`;
    const kTimer = `q:${eventId}:timer`;
    await redis.del(kActive);
    await redis.del(kTimer);
  }

  // Mark event as inactive (even if Redis is unavailable)
  await db
    .collection('events')
    .updateOne(
      { _id: new ObjectId(eventId) },
      { $set: { isActive: false, updatedAt: new Date() } }
    );

  res.json({ success: true });
};

export const enqueueUserAdmin = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { eventId, userId } = req.body;
  const db = await getDb();

  // Verify event exists
  const event = await db
    .collection('events')
    .findOne({ _id: new ObjectId(eventId) });
  if (!event) {
    throw new NotFoundError('Event', eventId);
  }

  const redis = await getRedis();
  const isConnected = await ensureEventKeys(redis, eventId);

  if (!isConnected) {
    throw new RedisError('Redis service unavailable');
  }

  await enqueueUser(redis, eventId, userId);
  await advanceQueue(redis, eventId, event.queueLimit, event.intervalSec);

  res.json({ success: true });
};

export const enqueueBatch = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { eventId, count } = req.body;
  const db = await getDb();

  // Verify event exists
  const event = await db
    .collection('events')
    .findOne({ _id: new ObjectId(eventId) });
  if (!event) {
    throw new NotFoundError('Event', eventId);
  }

  const redis = await getRedis();
  const isConnected = await ensureEventKeys(redis, eventId);

  if (!isConnected) {
    throw new RedisError('Redis service unavailable');
  }

  const users: string[] = [];
  for (let i = 0; i < count; i++) {
    const uid = 'user-' + Math.random().toString(36).slice(2, 8);
    users.push(uid);
    await enqueueUser(redis, eventId, uid);
  }

  await advanceQueue(redis, eventId, event.queueLimit, event.intervalSec);

  res.json({ success: true, users });
};
