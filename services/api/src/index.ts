import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getDb } from './mongo';
import {
  getRedis,
  advanceQueue,
  enqueueUser,
  getStatus,
  ensureEventKeys,
  isRedisConnected,
} from './queue';

const app = express();
app.use(express.json());

// Enable CORS for all routes
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Handle preflight requests
app.options('*', cors());

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Create API router
const router = express.Router();

// Mount API router under /api
app.use('/api', router);

// Simple scheduler to auto-advance active events
let redisBackoffUntil = 0;
let redisLogGuard = 0;
let redisWarningShown = false;
async function schedulerTick() {
  try {
    const now = Date.now();
    if (now < redisBackoffUntil) return;
    const db = await getDb();
    const events = await db
      .collection('events')
      .find({ isActive: true })
      .project({ _id: 1, queueLimit: 1, intervalSec: 1 })
      .toArray();
    if (events.length === 0) return;

    const redis = await getRedis();
    try {
      const connected = await isRedisConnected();
      if (!connected) {
        try {
          await redis.connect();
          redisWarningShown = false; // Reset warning flag on successful connection
        } catch (connectErr) {
          // Connection failed, will retry later
        }
      }
      await redis.ping();
      redisWarningShown = false; // Reset warning flag on successful ping
    } catch (e) {
      // Only show warning once, and provide helpful information
      if (!redisWarningShown) {
        redisWarningShown = true;
        console.warn(
          '[scheduler] Redis not available. Queue advancement is disabled.\n' +
          '  To enable queue features, start Redis:\n' +
          '  - Docker: docker compose up redis\n' +
          '  - Local: redis-server (or install with: sudo apt install redis-server)'
        );
      }
      redisBackoffUntil = now + 30000; // Increase backoff to 30 seconds to reduce checks
      return;
    }
    for (const e of events as any[]) {
      const eventId = String(e._id);
      try {
        const isConnected = await ensureEventKeys(redis, eventId);
        if (isConnected) {
          await advanceQueue(redis, eventId, e.queueLimit, e.intervalSec);
        }
      } catch (err) {
        // Skip this event if Redis operations fail
        console.warn(`[scheduler] Failed to process event ${eventId}:`, err instanceof Error ? err.message : String(err));
      }
    }
  } catch (err) {
    console.error('schedulerTick error:', err);
  }
}

// Run scheduler every 1s
setInterval(schedulerTick, 1000);

// Health check
router.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));
// Root health for platform probes
app.get('/', (_req: Request, res: Response) => res.json({ ok: true }));

// Admin: create domain
router.post('/admin/domain', async (req: Request, res: Response) => {
  const schema = z.object({ name: z.string().min(1) });
  const body = schema.parse(req.body);
  const db = await getDb();
  const existing = await db.collection('domains').findOne({ name: body.name });
  if (existing) return res.status(400).json({ error: 'Domain exists' });
  const { insertedId } = await db
    .collection('domains')
    .insertOne({ name: body.name });
  res.json({ domainId: String(insertedId), name: body.name });
});

// Admin: create event
router.post('/admin/event', async (req: Request, res: Response) => {
  const schema = z.object({
    domain: z.string().min(1),
    name: z.string().min(1),
    queueLimit: z.number().int().positive().default(2),
    intervalSec: z.number().int().positive().default(30),
  });
  const body = schema.parse(req.body);
  const db = await getDb();
  const domain = await db.collection('domains').findOne({ name: body.domain });
  if (!domain) return res.status(404).json({ error: 'Domain not found' });
  const event = {
    domain: body.domain,
    name: body.name,
    queueLimit: body.queueLimit,
    intervalSec: body.intervalSec,
    createdAt: new Date(),
  };
  const { insertedId } = await db.collection('events').insertOne(event);
  res.json({ eventId: String(insertedId), ...event });
});

// Admin: update config
router.put('/admin/event/:id', async (req: Request, res: Response) => {
  const schema = z.object({
    queueLimit: z.number().int().positive().optional(),
    intervalSec: z.number().int().positive().optional(),
    isActive: z.boolean().optional(),
  });

  try {
    const body = schema.parse(req.body);
    const db = await getDb();
    const updateResult = await db
      .collection('events')
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: body });

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(400).json({ error: 'Invalid request data' });
  }
});

// Admin: delete event
router.delete('/admin/event/:id', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const deleteResult = await db
      .collection('events')
      .deleteOne({ _id: new ObjectId(req.params.id) });

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(400).json({ error: 'Invalid request data' });
  }
});

// Admin: advance queue
router.post('/admin/event/:id/advance', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    if (!eventId) {
      return res.status(400).json({ error: 'Event ID is required' });
    }

    const db = await getDb();
    const event = await db
      .collection('events')
      .findOne({ _id: new ObjectId(eventId) });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const redis = await getRedis();
    const isConnected = await ensureEventKeys(redis, eventId);
    
    if (!isConnected) {
      return res.status(503).json({ error: 'Redis service unavailable' });
    }
    
    const kActive = `q:${eventId}:active`;
    const kWaiting = `q:${eventId}:waiting`;
    const kTimer = `q:${eventId}:timer`;

    await redis.del(kActive);

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

    res.json({
      ok: true,
      moved,
      active: await redis.lrange(kActive, 0, -1),
      waiting: await redis.lrange(kWaiting, 0, -1),
    });
  } catch (error) {
    console.error('Error advancing queue:', error);
    res.status(500).json({ error: 'Failed to advance queue' });
  }
});

// List all events (modified to not require domain)
router.get('/events', async (req: Request, res: Response) => {
  try {
    console.log('Fetching all events');
    const db = await getDb();
    const events = await db.collection('events').find({}).toArray();
    console.log(`Found ${events.length} events`);

    // Transform the events to include eventId as a string
    const formattedEvents = events.map((e: any) => ({
      _id: String(e._id),
      name: e.name,
      domain: e.domain,
      queueLimit: e.queueLimit,
      intervalSec: e.intervalSec,
      isActive: e.isActive || false,
    }));

    res.json(formattedEvents);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Join queue
router.post('/queue/join', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      eventId: z.string().min(1),
      userId: z.string().min(1),
    });
    const body = schema.parse(req.body);
    const db = await getDb();
    const event = await db
      .collection('events')
      .findOne({ _id: new ObjectId(body.eventId) });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const redis = await getRedis();
    const isConnected = await ensureEventKeys(redis, body.eventId);

    if (!isConnected) {
      // Redis not available, return error
      return res.status(503).json({
        success: false,
        error: 'Queue service temporarily unavailable. Please try again later.',
      });
    }

    // Check current queue status
    const status = await getStatus(redis, body.eventId, body.userId);

    // If queue is full, return a waiting status
    if (status.state === 'waiting' && status.position > event.queueLimit) {
      return res.json({
        success: false,
        status: 'waiting',
        message: 'Queue is full. Please wait...',
        waitTime: 30, // seconds
        position: status.position,
        total: status.total,
        activeUsers: status.activeUsers,
        waitingUsers: status.waitingUsers,
      });
    }

    // If not in queue, enqueue the user
    if (status.state !== 'active') {
      await enqueueUser(redis, body.eventId, body.userId);
      await advanceQueue(
        redis,
        body.eventId,
        event.queueLimit,
        event.intervalSec
      );
    }

    // Get updated status
    const updatedStatus = await getStatus(redis, body.eventId, body.userId);
    res.json({
      success: true,
      status: updatedStatus.state,
      ...updatedStatus,
    });
  } catch (error) {
    console.error('Error joining queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to join queue. Please try again later.',
    });
  }
});

// Status
router.get('/queue/status', async (req: Request, res: Response) => {
  try {
    const eventId = String(req.query.eventId || '');
    const userId = String(req.query.userId || '');
    const db = await getDb();
    const event = await db
      .collection('events')
      .findOne({ _id: new ObjectId(eventId) });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    const redis = await getRedis();
    const isConnected = await ensureEventKeys(redis, eventId);
    
    if (!isConnected) {
      // Redis not available, return default waiting status
      return res.json({
        state: 'waiting',
        position: 0,
        total: 0,
        timeRemaining: 0,
        activeUsers: 0,
        waitingUsers: 0,
      });
    }
    
    await advanceQueue(redis, eventId, event.queueLimit, event.intervalSec);
    const status = await getStatus(redis, eventId, userId);
    res.json(status);
  } catch (error) {
    console.error('Error getting queue status:', error);
    // Return default status instead of crashing
    res.json({
      state: 'waiting',
      position: 0,
      total: 0,
      timeRemaining: 0,
      activeUsers: 0,
      waitingUsers: 0,
    });
  }
});

// Admin: list users in an event (active and waiting)
router.get('/admin/event/users', async (req: Request, res: Response) => {
  try {
    const eventId = String(req.query.eventId || '');
    if (!eventId) return res.status(400).json({ error: 'eventId required' });
    const db = await getDb();
    const event = await db
      .collection('events')
      .findOne({ _id: new ObjectId(eventId) });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    const redis = await getRedis();
    const isConnected = await ensureEventKeys(redis, eventId);
    
    if (!isConnected) {
      // Redis not available, return empty queue data
      return res.json({ active: [], waiting: [], remaining: 0 });
    }
    
    // Advance queue here so Admin view reflects backend-managed state
    await advanceQueue(redis, eventId, event.queueLimit, event.intervalSec);
    const kActive = `q:${eventId}:active`;
    const kWaiting = `q:${eventId}:waiting`;
    const kTimer = `q:${eventId}:timer`;
    const [active, waiting, ttl] = await Promise.all([
      redis.lrange(kActive, 0, -1),
      redis.lrange(kWaiting, 0, -1),
      redis.ttl(kTimer),
    ]);
    res.json({ active, waiting, remaining: Math.max(0, ttl) });
  } catch (error) {
    console.error('Error fetching queue users:', error);
    // Return empty data instead of crashing
    res.json({ active: [], waiting: [], remaining: 0 });
  }
});

// Admin: enqueue a single user into an event
app.post('/admin/event/enqueue', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      eventId: z.string().min(1),
      userId: z.string().min(1),
    });
    const body = schema.parse(req.body);
    const db = await getDb();
    const event = await db
      .collection('events')
      .findOne({ _id: new ObjectId(body.eventId) });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    const redis = await getRedis();
    const isConnected = await ensureEventKeys(redis, body.eventId);
    
    if (!isConnected) {
      return res.status(503).json({ error: 'Redis service unavailable' });
    }
    
    await enqueueUser(redis, body.eventId, body.userId);
    await advanceQueue(redis, body.eventId, event.queueLimit, event.intervalSec);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error enqueueing user:', error);
    res.status(500).json({ error: 'Failed to enqueue user' });
  }
});

// Admin: enqueue N dummy users
app.post('/admin/event/enqueue-batch', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      eventId: z.string().min(1),
      count: z.number().int().positive().max(50).default(1),
    });
    const body = schema.parse(req.body);
    const db = await getDb();
    const event = await db
      .collection('events')
      .findOne({ _id: new ObjectId(body.eventId) });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    const redis = await getRedis();
    const isConnected = await ensureEventKeys(redis, body.eventId);
    
    if (!isConnected) {
      return res.status(503).json({ error: 'Redis service unavailable' });
    }
    
    const users: string[] = [];
    for (let i = 0; i < body.count; i++) {
      const uid = 'user-' + Math.random().toString(36).slice(2, 8);
      users.push(uid);
      await enqueueUser(redis, body.eventId, uid);
    }
    await advanceQueue(redis, body.eventId, event.queueLimit, event.intervalSec);
    res.json({ ok: true, users });
  } catch (error) {
    console.error('Error enqueueing batch:', error);
    res.status(500).json({ error: 'Failed to enqueue users' });
  }
});

// Admin: start the queue window now (even if not full)
router.post('/admin/event/start', async (req: Request, res: Response) => {
  try {
    const schema = z.object({ eventId: z.string().min(1) });
    const body = schema.parse(req.body);
    const db = await getDb();
    const event = await db
      .collection('events')
      .findOne({ _id: new ObjectId(body.eventId) });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    const redis = await getRedis();
    const isConnected = await ensureEventKeys(redis, body.eventId);
    
    if (!isConnected) {
      return res.status(503).json({ error: 'Redis service unavailable' });
    }
    
    const kActive = `q:${body.eventId}:active`;
    const kWaiting = `q:${body.eventId}:waiting`;
    const kTimer = `q:${body.eventId}:timer`;
    
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
    // Mark event active
    await db
      .collection('events')
      .updateOne({ _id: new ObjectId(body.eventId) }, { $set: { isActive: true } });
    res.json({ ok: true });
  } catch (error) {
    console.error('Error starting queue:', error);
    res.status(500).json({ error: 'Failed to start queue' });
  }
});

// Admin: stop the queue window now
router.post('/admin/event/stop', async (req: Request, res: Response) => {
  try {
    const schema = z.object({ eventId: z.string().min(1) });
    const body = schema.parse(req.body);
    const db = await getDb();
    const event = await db
      .collection('events')
      .findOne({ _id: new ObjectId(body.eventId) });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const redis = await getRedis();
    const isConnected = await ensureEventKeys(redis, body.eventId);
    
    if (isConnected) {
      const kActive = `q:${body.eventId}:active`;
      const kTimer = `q:${body.eventId}:timer`;
      // Clear active batch and timer
      await redis.del(kActive);
      await redis.del(kTimer);
    }
    
    // Mark event inactive (even if Redis is unavailable)
    await db
      .collection('events')
      .updateOne({ _id: new ObjectId(body.eventId) }, { $set: { isActive: false } });
    res.json({ ok: true });
  } catch (error) {
    console.error('Error stopping queue:', error);
    res.status(500).json({ error: 'Failed to stop queue' });
  }
});

// Admin: get entry history for an event
app.get('/admin/event/entries', async (req: Request, res: Response) => {
  const eventId = String(req.query.eventId || '');
  if (!eventId) return res.status(400).json({ error: 'eventId required' });
  const db = await getDb();
  const list = await db
    .collection('entries')
    .find({ eventId })
    .project({ _id: 0 })
    .sort({ enteredAt: -1 })
    .limit(200)
    .toArray();
  res.json(list);
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, '0.0.0.0', () => {
  (async () => {
    try {
      await getDb();
    } catch (e) {
      console.error('DB init failed (continuing to listen):', e);
    }
    try {
      await getRedis();
    } catch (e) {
      console.error('Redis init failed (continuing to listen):', e);
    }
    console.log(`API listening on :${PORT}`);
  })();
});
