import { get } from './http';
import type { Event } from './types';

export async function getEvents(): Promise<Event[]> {
  return get<Event[]>('/events');
}

export async function getEvent(eventId: string): Promise<Event> {
  if (!eventId || typeof eventId !== 'string') {
    throw new Error('Event ID is required and must be a string');
  }
  return get<Event>(`/events/${eventId}`);
}
