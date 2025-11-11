export interface QueueStatus {
  state: 'waiting' | 'active' | 'completed';
  position: number;
  total: number;
  remaining: number;
}

export interface Event {
  _id: string;
  name: string;
  domain: string;
  queueLimit: number;
  intervalSec: number;
  isActive: boolean;
}

let BASE = '';

// Initialize API base URL
export function init(opts: { baseUrl: string }) {
  BASE = opts.baseUrl.replace(/\/$/, '');
}

// Event related API calls
export async function getEvents(): Promise<Event[]> {
  const response = await fetch(`${BASE}/events`);
  if (!response.ok) throw new Error('Failed to fetch events');
  return response.json();
}

export async function getEvent(eventId: string): Promise<Event> {
  const response = await fetch(`${BASE}/events/${eventId}`);
  if (!response.ok) throw new Error('Failed to fetch event');
  return response.json();
}

// Queue related API calls
export async function joinQueue(eventId: string, userId: string): Promise<QueueStatus> {
  const response = await fetch(`${BASE}/queue/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, userId }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to join queue');
  }
  return response.json();
}

export async function getQueueStatus(eventId: string, userId: string): Promise<QueueStatus> {
  const url = new URL(`${BASE}/queue/status`);
  url.searchParams.set('eventId', eventId);
  url.searchParams.set('userId', userId);
  
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Failed to get queue status');
  }
  return response.json();
}

// Admin API calls (for admin panel)
export async function createEvent(eventData: Omit<Event, '_id'>) {
  const response = await fetch(`${BASE}/admin/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventData),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to create event');
  }
  return response.json();
}

export async function updateEvent(eventId: string, updates: Partial<Event>) {
  const response = await fetch(`${BASE}/admin/events/${eventId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to update event');
  }
  return response.json();
}

export async function getQueueUsers(eventId: string) {
  const response = await fetch(`${BASE}/admin/events/${eventId}/queue`);
  if (!response.ok) {
    throw new Error('Failed to get queue users');
  }
  return response.json();
}

export async function updateQueueStatus(eventId: string, isActive: boolean) {
  const response = await fetch(`${BASE}/admin/events/${eventId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to update queue status');
  }
  return response.json();
}
