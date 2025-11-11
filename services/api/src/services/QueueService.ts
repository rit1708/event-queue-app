import Redis from 'ioredis';
import { EventService } from './EventService';
import { EntryRepository } from '../repositories/EntryRepository';
import {
  enqueueUser,
  advanceQueue,
  getQueueStatus,
  getQueueData,
  clearQueue,
  ensureEventKeys,
} from '../database/queue';
import { JoinQueueDto, QueueStatus, QueueData } from '../types';
import { NotFoundError, BadRequestError } from '../errors/AppError';
import logger from '../config/logger';

export class QueueService {
  constructor(
    private eventService: EventService,
    private entryRepository: EntryRepository,
    private redis: Redis
  ) {}

  async joinQueue(dto: JoinQueueDto): Promise<QueueStatus> {
    const event = await this.eventService.getEventById(dto.eventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    await ensureEventKeys(this.redis, dto.eventId);

    // Check current status
    const currentStatus = await getQueueStatus(this.redis, dto.eventId, dto.userId);

    // If user is already active, return current status
    if (currentStatus.state === 'active') {
      return currentStatus;
    }

    // If user is not in queue, enqueue them
    if (currentStatus.state === 'not_queued') {
      await enqueueUser(this.redis, dto.eventId, dto.userId);
    }

    // Advance queue if needed
    await advanceQueue(this.redis, dto.eventId, event.queueLimit, event.intervalSec);

    // Get updated status
    const updatedStatus = await getQueueStatus(this.redis, dto.eventId, dto.userId);
    return updatedStatus;
  }

  async getStatus(eventId: string, userId: string): Promise<QueueStatus> {
    const event = await this.eventService.getEventById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    await ensureEventKeys(this.redis, eventId);
    await advanceQueue(this.redis, eventId, event.queueLimit, event.intervalSec);
    
    const status = await getQueueStatus(this.redis, eventId, userId);
    return status;
  }

  async getQueueData(eventId: string): Promise<QueueData> {
    const event = await this.eventService.getEventById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    await ensureEventKeys(this.redis, eventId);
    await advanceQueue(this.redis, eventId, event.queueLimit, event.intervalSec);
    
    return await getQueueData(this.redis, eventId);
  }

  async manuallyAdvanceQueue(eventId: string): Promise<QueueData> {
    const event = await this.eventService.getEventById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    await ensureEventKeys(this.redis, eventId);
    
    // Clear active queue and move users from waiting
    const keys = {
      active: `q:${eventId}:active`,
      waiting: `q:${eventId}:waiting`,
      timer: `q:${eventId}:timer`,
    };

    await this.redis.del(keys.active);

    const moved: string[] = [];
    for (let i = 0; i < event.queueLimit; i++) {
      const user = await this.redis.lpop(keys.waiting);
      if (!user) break;
      moved.push(user);
    }

    if (moved.length > 0) {
      await this.redis.rpush(keys.active, ...moved);
      await this.redis.set(keys.timer, '1', 'EX', event.intervalSec);
    } else {
      await this.redis.del(keys.timer);
    }

    return await getQueueData(this.redis, eventId);
  }

  async startQueue(eventId: string): Promise<void> {
    const event = await this.eventService.getEventById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    await ensureEventKeys(this.redis, eventId);
    
    const keys = {
      active: `q:${eventId}:active`,
      waiting: `q:${eventId}:waiting`,
      timer: `q:${eventId}:timer`,
    };

    // Backfill at least one user to active if empty
    let activeLen = await this.redis.llen(keys.active);
    if (activeLen === 0) {
      const user = await this.redis.lpop(keys.waiting);
      if (user) {
        await this.redis.rpush(keys.active, user);
        activeLen = 1;
      }
    }

    if (activeLen > 0) {
      await this.redis.set(keys.timer, '1', 'EX', event.intervalSec);
    }

    await this.eventService.startEvent(eventId);
    logger.info('Queue started', { eventId });
  }

  async stopQueue(eventId: string): Promise<void> {
    const event = await this.eventService.getEventById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    await ensureEventKeys(this.redis, eventId);
    
    const keys = {
      active: `q:${eventId}:active`,
      timer: `q:${eventId}:timer`,
    };

    await this.redis.del(keys.active);
    await this.redis.del(keys.timer);

    await this.eventService.stopEvent(eventId);
    logger.info('Queue stopped', { eventId });
  }

  async enqueueBatchUsers(eventId: string, count: number): Promise<string[]> {
    const event = await this.eventService.getEventById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    if (count < 1 || count > 50) {
      throw new BadRequestError('Count must be between 1 and 50');
    }

    await ensureEventKeys(this.redis, eventId);

    const users: string[] = [];
    for (let i = 0; i < count; i++) {
      const uid = 'user-' + Math.random().toString(36).slice(2, 8);
      users.push(uid);
      await enqueueUser(this.redis, eventId, uid);
    }

    await advanceQueue(this.redis, eventId, event.queueLimit, event.intervalSec);
    logger.info('Batch users enqueued', { eventId, count });
    
    return users;
  }

  async getEntryHistory(eventId: string, limit: number = 200) {
    return await this.entryRepository.findByEventId(eventId, limit);
  }
}

