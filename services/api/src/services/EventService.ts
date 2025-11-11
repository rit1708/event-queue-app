import { EventRepository } from '../repositories/EventRepository';
import { CreateEventDto, UpdateEventDto, Event } from '../types';
import { NotFoundError } from '../errors/AppError';

export class EventService {
  constructor(private eventRepository: EventRepository) {}

  async getAllEvents(): Promise<Event[]> {
    return await this.eventRepository.findAll();
  }

  async getActiveEvents(): Promise<Event[]> {
    return await this.eventRepository.findActive();
  }

  async getEventById(id: string): Promise<Event> {
    const event = await this.eventRepository.findById(id);
    if (!event) {
      throw new NotFoundError('Event not found');
    }
    return event;
  }

  async createEvent(dto: CreateEventDto): Promise<Event> {
    return await this.eventRepository.create(dto);
  }

  async updateEvent(id: string, dto: UpdateEventDto): Promise<Event> {
    return await this.eventRepository.update(id, dto);
  }

  async deleteEvent(id: string): Promise<void> {
    await this.eventRepository.delete(id);
  }

  async startEvent(id: string): Promise<Event> {
    return await this.eventRepository.update(id, { isActive: true });
  }

  async stopEvent(id: string): Promise<Event> {
    return await this.eventRepository.update(id, { isActive: false });
  }
}

