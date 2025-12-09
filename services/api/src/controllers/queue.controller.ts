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

  // Check entry window availability (Entry Timer Logic)
  const k = keys(eventId);

  // Check if user is actually in the queue (active or waiting)
  const [activeList, waitingList, ttl, activeLen, waitingLen] =
    await Promise.all([
      redis.lrange(k.active, 0, -1),
      redis.lrange(k.waiting, 0, -1),
      redis.ttl(k.timer),
      redis.llen(k.active),
      redis.llen(k.waiting),
    ]);

  const userInActive = activeList.indexOf(userId) !== -1;
  const userInWaiting = waitingList.indexOf(userId) !== -1;
  const userInQueue = userInActive || userInWaiting;

  // If user is already active, return active status with all fields
  if (userInActive) {
    const status = await getStatus(redis, eventId, userId);
    res.json({
      success: true,
      status: 'active',
      state: 'active',
      position: status.position ?? 0,
      total: activeLen + waitingLen,
      timeRemaining: Math.max(0, ttl),
      activeUsers: activeLen,
      waitingUsers: waitingLen,
      showWaitingTimer: false,
    });
    return;
  }

  const entryWindowActive = ttl > 0; // Entry timer is running
  const hasAvailableSlots = activeLen < event.queueLimit; // Not at capacity
  // Can enter directly if:
  // 1. Timer expired AND no users waiting (timer completed/restarted, queue is open)
  // 2. Timer active AND slots available
  const canEnterDirectly = (!entryWindowActive && waitingLen === 0) || hasAvailableSlots;

  // If user is not in queue and can enter directly
  if (!userInQueue && canEnterDirectly) {
    // Add user directly to active queue
    await redis.sadd(k.userset, userId);
    await redis.rpush(k.active, userId);

    // Get updated status
    const updatedStatus = await getStatus(redis, eventId, userId);
    const [finalTtl, finalActiveLen, finalWaitingLen] = await Promise.all([
      redis.ttl(k.timer),
      redis.llen(k.active),
      redis.llen(k.waiting),
    ]);

    // If timer expired and user entered directly (timer completed/restarted scenario),
    // start a new entry window timer
    const wasTimerExpired = !entryWindowActive && waitingLen === 0;
    const newActiveLen = finalActiveLen;
    
    // Start/refresh timer if:
    // 1. Queue is now full, OR
    // 2. Timer was expired and user entered (restart entry window)
    if (newActiveLen >= event.queueLimit || wasTimerExpired) {
      await redis.set(k.timer, '1', 'EX', event.intervalSec);
      const updatedTtl = await redis.ttl(k.timer);
      
      if (newActiveLen >= event.queueLimit) {
        // User entered when queue was available, but now it's full
        // They need to wait for the interval timer to complete
        res.json({
          success: true,
          status: 'active',
          state: 'active',
          position: updatedStatus.position ?? 0,
          total: updatedStatus.total ?? finalActiveLen + finalWaitingLen,
          timeRemaining: Math.max(0, updatedTtl), // Show interval timer
          activeUsers: finalActiveLen,
          waitingUsers: finalWaitingLen,
          showWaitingTimer: false,
        });
      } else {
        // Timer restarted, queue not full yet - user can enter directly
        // Set timeRemaining to 0 so redirect happens immediately
        res.json({
          success: true,
          status: 'active',
          state: 'active',
          position: updatedStatus.position ?? 0,
          total: updatedStatus.total ?? finalActiveLen + finalWaitingLen,
          timeRemaining: 0, // No timer - redirect immediately
          activeUsers: finalActiveLen,
          waitingUsers: finalWaitingLen,
          showWaitingTimer: false,
        });
      }
    } else {
      // Queue still has slots and timer is active - user can enter immediately
      // Set timeRemaining to 0 so redirect happens immediately
      res.json({
        success: true,
        status: 'active',
        state: 'active',
        position: updatedStatus.position ?? 0,
        total: updatedStatus.total ?? finalActiveLen + finalWaitingLen,
        timeRemaining: 0, // No timer - redirect immediately
        activeUsers: finalActiveLen,
        waitingUsers: finalWaitingLen,
        showWaitingTimer: false,
      });
    }

    // Log entry to Mongo
    try {
      await db
        .collection('entries')
        .insertOne({ eventId, userId, enteredAt: new Date() });
    } catch {}

    return;
  }

  // If user is not in queue but cannot enter directly (entry window full)
  if (!userInQueue && !canEnterDirectly) {
    // Add user to waiting queue
    await enqueueUser(redis, eventId, userId);

    // Get updated status
    const updatedStatus = await getStatus(redis, eventId, userId);
    const [finalTtl, finalActiveLen, finalWaitingLen] = await Promise.all([
      redis.ttl(k.timer),
      redis.llen(k.active),
      redis.llen(k.waiting),
    ]);

    // Always use direct Redis counts for accuracy
    res.json({
      success: true,
      status: 'waiting',
      state: 'waiting',
      position: updatedStatus.position ?? 0,
      total: finalActiveLen + finalWaitingLen,
      timeRemaining: Math.max(0, finalTtl),
      activeUsers: finalActiveLen,
      waitingUsers: finalWaitingLen,
      showWaitingTimer: true, // Show waiting timer (interval timer)
      waitingTimerDuration: event.intervalSec, // Use event's intervalSec
    });
    return;
  }

  // If user is already in waiting queue
  if (userInWaiting) {
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

    const [finalTtl3, finalActiveLen3, finalWaitingLen3] = await Promise.all([
      redis.ttl(k.timer),
      redis.llen(k.active),
      redis.llen(k.waiting),
    ]);

    // Always use direct Redis counts for accuracy
    res.json({
      success: true,
      status: updatedStatus.state,
      state: updatedStatus.state,
      position: updatedStatus.position ?? 0,
      total: finalActiveLen3 + finalWaitingLen3,
      timeRemaining: Math.max(0, finalTtl3),
      activeUsers: finalActiveLen3,
      waitingUsers: finalWaitingLen3,
      showWaitingTimer: shouldShowTimer,
      waitingTimerDuration: shouldShowTimer ? event.intervalSec : 0,
    });
    return;
  }

  // Fallback: enqueue and advance
  await enqueueUser(redis, eventId, userId);
  await advanceQueue(redis, eventId, event.queueLimit, event.intervalSec);
  const updatedStatus = await getStatus(redis, eventId, userId);
  const [finalTtl, finalActiveLen, finalWaitingLen] = await Promise.all([
    redis.ttl(k.timer),
    redis.llen(k.active),
    redis.llen(k.waiting),
  ]);

  // Always use direct Redis counts for accuracy
  res.json({
    success: true,
    status: updatedStatus.state,
    state: updatedStatus.state,
    position: updatedStatus.position ?? 0,
    total: finalActiveLen + finalWaitingLen,
    timeRemaining: Math.max(0, finalTtl),
    activeUsers: finalActiveLen,
    waitingUsers: finalWaitingLen,
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
  const [ttl, activeLen, waitingLen] = await Promise.all([
    redis.ttl(k.timer),
    redis.llen(k.active),
    redis.llen(k.waiting),
  ]);
  const entryWindowFull = ttl > 0 && activeLen >= event.queueLimit;
  const shouldShowTimer = status.state === 'waiting' && entryWindowFull;

  // Ensure timeRemaining is always accurate - use TTL from Redis
  const finalTimeRemaining = Math.max(0, ttl);

  // Always use the actual Redis counts to ensure accuracy
  const finalActiveUsers = activeLen;
  const finalWaitingUsers = waitingLen;
  const finalTotal = finalActiveUsers + finalWaitingUsers;

  res.json({
    state: status.state,
    position:
      status.position ?? (status.state === 'active' ? 0 : finalWaitingUsers),
    total: status.total ?? finalTotal,
    timeRemaining: finalTimeRemaining,
    activeUsers: finalActiveUsers,
    waitingUsers: finalWaitingUsers,
    showWaitingTimer: shouldShowTimer,
    waitingTimerDuration: shouldShowTimer ? event.intervalSec : 0,
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
    const emptyQueue: QueueUsers = {
      active: [],
      waiting: [],
      remaining: 0,
    };
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

  // Ensure we return arrays even if Redis returns null/undefined
  const activeUsers = Array.isArray(active) ? active : [];
  const waitingUsers = Array.isArray(waiting) ? waiting : [];

  res.json({
    active: activeUsers,
    waiting: waitingUsers,
    remaining: Math.max(0, ttl || 0),
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
