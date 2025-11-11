import { EventService } from './EventService';
import { getRedis } from '../database/redis';
import { advanceQueue, ensureEventKeys } from '../database/queue';
import { env } from '../config/env';
import logger from '../config/logger';

export class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(private eventService: EventService) {}

  async tick(): Promise<void> {
    if (this.isRunning) {
      return; // Prevent overlapping ticks
    }

    this.isRunning = true;

    try {
      const events = await this.eventService.getActiveEvents();
      if (events.length === 0) {
        return;
      }

      const redis = await getRedis();

      for (const event of events) {
        try {
          const eventId = event._id.toString();
          await ensureEventKeys(redis, eventId);
          await advanceQueue(redis, eventId, event.queueLimit, event.intervalSec);
        } catch (error) {
          logger.error('Scheduler tick error for event:', {
            eventId: event._id.toString(),
            error,
          });
        }
      }
    } catch (error) {
      logger.error('Scheduler tick error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  start(): void {
    if (this.intervalId) {
      logger.warn('Scheduler is already running');
      return;
    }

    logger.info('Starting scheduler', {
      interval: env.SCHEDULER_INTERVAL_MS,
    });

    // Run immediately
    this.tick();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.tick();
    }, env.SCHEDULER_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Scheduler stopped');
    }
  }

  isActive(): boolean {
    return this.intervalId !== null;
  }
}

