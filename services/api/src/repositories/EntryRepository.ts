import { Db } from 'mongodb';
import { QueueEntry } from '../types';
import logger from '../config/logger';

export class EntryRepository {
  constructor(private db: Db) {}

  async findByEventId(eventId: string, limit: number = 200): Promise<QueueEntry[]> {
    try {
      const entries = await this.db
        .collection<QueueEntry>('entries')
        .find({ eventId })
        .sort({ enteredAt: -1 })
        .limit(limit)
        .toArray();
      return entries;
    } catch (error) {
      logger.error('Failed to find entries by event id:', error);
      throw error;
    }
  }

  async create(eventId: string, userId: string): Promise<QueueEntry> {
    try {
      const entry: Omit<QueueEntry, '_id'> = {
        eventId,
        userId,
        enteredAt: new Date(),
      };

      const result = await this.db
        .collection<QueueEntry>('entries')
        .insertOne(entry as any);

      const created = await this.db
        .collection<QueueEntry>('entries')
        .findOne({ _id: result.insertedId });

      if (!created) {
        throw new Error('Failed to retrieve created entry');
      }

      return created;
    } catch (error) {
      logger.error('Failed to create entry:', error);
      throw error;
    }
  }
}

