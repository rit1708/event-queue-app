import { Db, ObjectId } from 'mongodb';
import { Event, CreateEventDto, UpdateEventDto } from '../types';
import { NotFoundError, ConflictError } from '../errors/AppError';
import logger from '../config/logger';

export class EventRepository {
  constructor(private db: Db) {}

  async findAll(): Promise<Event[]> {
    try {
      const events = await this.db.collection<Event>('events').find({}).toArray();
      return events;
    } catch (error) {
      logger.error('Failed to find events:', error);
      throw error;
    }
  }

  async findActive(): Promise<Event[]> {
    try {
      const events = await this.db
        .collection<Event>('events')
        .find({ isActive: true })
        .project({ _id: 1, queueLimit: 1, intervalSec: 1, domain: 1, name: 1 })
        .toArray();
      return events;
    } catch (error) {
      logger.error('Failed to find active events:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Event | null> {
    try {
      if (!ObjectId.isValid(id)) {
        return null;
      }
      const event = await this.db
        .collection<Event>('events')
        .findOne({ _id: new ObjectId(id) });
      return event;
    } catch (error) {
      logger.error('Failed to find event by id:', error);
      throw error;
    }
  }

  async findByDomain(domain: string): Promise<Event[]> {
    try {
      const events = await this.db
        .collection<Event>('events')
        .find({ domain })
        .toArray();
      return events;
    } catch (error) {
      logger.error('Failed to find events by domain:', error);
      throw error;
    }
  }

  async create(dto: CreateEventDto): Promise<Event> {
    try {
      // Check if domain exists (would need domain repository, but for now we'll check)
      const domainExists = await this.db
        .collection('domains')
        .findOne({ name: dto.domain });
      
      if (!domainExists) {
        throw new NotFoundError(`Domain "${dto.domain}" not found`);
      }

      // Check if event with same name and domain already exists
      const existing = await this.db
        .collection<Event>('events')
        .findOne({ domain: dto.domain, name: dto.name });
      
      if (existing) {
        throw new ConflictError(`Event "${dto.name}" already exists for domain "${dto.domain}"`);
      }

      const event: Omit<Event, '_id'> = {
        domain: dto.domain,
        name: dto.name,
        queueLimit: dto.queueLimit,
        intervalSec: dto.intervalSec,
        isActive: false,
        createdAt: new Date(),
      };

      const result = await this.db.collection<Event>('events').insertOne(event as any);
      
      const created = await this.findById(result.insertedId.toString());
      if (!created) {
        throw new Error('Failed to retrieve created event');
      }

      logger.info('Event created', {
        eventId: result.insertedId.toString(),
        name: dto.name,
        domain: dto.domain,
      });
      return created;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      logger.error('Failed to create event:', error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateEventDto): Promise<Event> {
    try {
      if (!ObjectId.isValid(id)) {
        throw new NotFoundError('Event not found');
      }

      const updateResult = await this.db
        .collection<Event>('events')
        .updateOne({ _id: new ObjectId(id) }, { $set: dto });

      if (updateResult.matchedCount === 0) {
        throw new NotFoundError('Event not found');
      }

      const updated = await this.findById(id);
      if (!updated) {
        throw new Error('Failed to retrieve updated event');
      }

      logger.info('Event updated', { eventId: id, updates: dto });
      return updated;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to update event:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      if (!ObjectId.isValid(id)) {
        throw new NotFoundError('Event not found');
      }

      const result = await this.db
        .collection<Event>('events')
        .deleteOne({ _id: new ObjectId(id) });

      if (result.deletedCount === 0) {
        throw new NotFoundError('Event not found');
      }

      logger.info('Event deleted', { eventId: id });
      return true;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to delete event:', error);
      throw error;
    }
  }
}

