import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo';
import { getRedis, advanceQueue, enqueueUser, getStatus, ensureEventKeys } from '../db/queue';
import { NotFoundError, RedisError } from '../utils/errors';
import { QueueStatus, QueueUsers } from '../types';

export const joinQueue = async (req: Request, res: Response): Promise<void> => {
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
    throw new RedisError('Queue service temporarily unavailable. Please try again later.');
  }

  // Check current queue status
  const status = await getStatus(redis, eventId, userId);

  // If queue is full, return waiting status
  if (status.state === 'waiting' && status.position > event.queueLimit) {
    res.json({
      success: false,
      status: 'waiting',
      message: 'Queue is full. Please wait...',
      waitTime: event.intervalSec,
      position: status.position,
      total: status.total,
      activeUsers: status.activeUsers,
      waitingUsers: status.waitingUsers,
    });
    return;
  }

  // If not in queue, enqueue the user
  if (status.state !== 'active') {
    await enqueueUser(redis, eventId, userId);
    await advanceQueue(redis, eventId, event.queueLimit, event.intervalSec);
  }

  // Get updated status
  const updatedStatus = await getStatus(redis, eventId, userId);
  res.json({
    success: true,
    status: updatedStatus.state,
    ...updatedStatus,
  });
};

export const getQueueStatus = async (req: Request, res: Response): Promise<void> => {
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
    res.json(defaultStatus);
    return;
  }

  await advanceQueue(redis, eventId, event.queueLimit, event.intervalSec);
  const status = await getStatus(redis, eventId, userId);
  res.json(status);
};

export const getQueueUsers = async (req: Request, res: Response): Promise<void> => {
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

export const advanceQueueManually = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const db = await getDb();

  // Verify event exists
  const event = await db.collection('events').findOne({ _id: new ObjectId(id) });
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

export const startQueue = async (req: Request, res: Response): Promise<void> => {
  const { eventId } = req.body;
  const db = await getDb();

  // Verify event exists
  const event = await db.collection('events').findOne({ _id: new ObjectId(eventId) });
  if (!event) {
    throw new NotFoundError('Event', eventId);
  }

  const redis = await getRedis();
  const isConnected = await ensureEventKeys(redis, eventId);

  if (!isConnected) {
    throw new RedisError('Redis service unavailable');
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
    .updateOne({ _id: new ObjectId(eventId) }, { $set: { isActive: true, updatedAt: new Date() } });

  res.json({ success: true });
};

export const stopQueue = async (req: Request, res: Response): Promise<void> => {
  const { eventId } = req.body;
  const db = await getDb();

  // Verify event exists
  const event = await db.collection('events').findOne({ _id: new ObjectId(eventId) });
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
    .updateOne({ _id: new ObjectId(eventId) }, { $set: { isActive: false, updatedAt: new Date() } });

  res.json({ success: true });
};

export const enqueueUserAdmin = async (req: Request, res: Response): Promise<void> => {
  const { eventId, userId } = req.body;
  const db = await getDb();

  // Verify event exists
  const event = await db.collection('events').findOne({ _id: new ObjectId(eventId) });
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

export const enqueueBatch = async (req: Request, res: Response): Promise<void> => {
  const { eventId, count } = req.body;
  const db = await getDb();

  // Verify event exists
  const event = await db.collection('events').findOne({ _id: new ObjectId(eventId) });
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

