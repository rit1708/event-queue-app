import { post, put, get, del } from './http';
import type { Event, QueueUsers } from './types';
import { ValidationError } from './types';

export async function getDomains(): Promise<{ _id: string; name: string; createdAt?: Date }[]> {
  return get<{ _id: string; name: string; createdAt?: Date }[]>('/admin/domain');
}

export async function createDomain(
  name: string
): Promise<{ domainId: string; name: string }> {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError(
      'Domain name is required and must be a non-empty string'
    );
  }
  return post<{ domainId: string; name: string }>('/admin/domain', { name });
}

export async function createEvent(params: {
  domain: string;
  name: string;
  queueLimit: number;
  intervalSec: number;
}): Promise<Event> {
  if (!params.domain || typeof params.domain !== 'string') {
    throw new ValidationError('Domain is required and must be a string');
  }
  if (!params.name || typeof params.name !== 'string') {
    throw new ValidationError('Event name is required and must be a string');
  }
  if (typeof params.queueLimit !== 'number' || params.queueLimit < 1) {
    throw new ValidationError('Queue limit must be a positive number');
  }
  if (typeof params.intervalSec !== 'number' || params.intervalSec < 1) {
    throw new ValidationError('Interval seconds must be a positive number');
  }

  return post<Event>('/admin/event', params);
}

export async function updateEvent(
  eventId: string,
  updates: Partial<Event>
): Promise<{ ok: boolean }> {
  if (!eventId || typeof eventId !== 'string') {
    throw new ValidationError('Event ID is required and must be a string');
  }

  if (
    updates.queueLimit !== undefined &&
    (typeof updates.queueLimit !== 'number' || updates.queueLimit < 1)
  ) {
    throw new ValidationError('Queue limit must be a positive number');
  }
  if (
    updates.intervalSec !== undefined &&
    (typeof updates.intervalSec !== 'number' || updates.intervalSec < 1)
  ) {
    throw new ValidationError('Interval seconds must be a positive number');
  }

  return put<{ ok: boolean }>(`/admin/event/${eventId}`, updates);
}

export async function deleteEvent(eventId: string): Promise<{ ok: boolean }> {
  if (!eventId || typeof eventId !== 'string') {
    throw new ValidationError('Event ID is required and must be a string');
  }
  return del<{ ok: boolean }>(`/admin/event/${eventId}`);
}

export async function getQueueUsers(eventId: string): Promise<QueueUsers> {
  if (!eventId || typeof eventId !== 'string') {
    throw new ValidationError('Event ID is required and must be a string');
  }
  return get<QueueUsers>(
    `/admin/event/users?eventId=${encodeURIComponent(eventId)}`
  );
}

export async function updateQueueStatus(
  eventId: string,
  isActive: boolean
): Promise<{ ok: boolean }> {
  if (!eventId || typeof eventId !== 'string') {
    throw new ValidationError('Event ID is required and must be a string');
  }
  return put<{ ok: boolean }>(`/admin/event/${eventId}`, { isActive });
}

export async function advanceQueue(eventId: string): Promise<{
  ok: boolean;
  moved: string[];
  active: string[];
  waiting: string[];
}> {
  if (!eventId || typeof eventId !== 'string') {
    throw new ValidationError('Event ID is required and must be a string');
  }
  return post<{
    ok: boolean;
    moved: string[];
    active: string[];
    waiting: string[];
  }>(`/admin/event/${eventId}/advance`);
}

export async function startQueue(eventId: string): Promise<{ ok: boolean }> {
  if (!eventId || typeof eventId !== 'string') {
    throw new ValidationError('Event ID is required and must be a string');
  }
  return post<{ ok: boolean }>('/admin/event/start', { eventId });
}

export async function stopQueue(eventId: string): Promise<{ ok: boolean }> {
  if (!eventId || typeof eventId !== 'string') {
    throw new ValidationError('Event ID is required and must be a string');
  }
  return post<{ ok: boolean }>('/admin/event/stop', { eventId });
}

// Token management functions
export interface Token {
  _id: string;
  name?: string;
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  isExpired?: boolean;
  lastUsedAt?: Date;
}

export interface GenerateTokenResponse {
  _id: string;
  token: string; // Only returned on creation
  name?: string;
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export async function generateToken(params: {
  name?: string;
  expiresInDays?: number;
  neverExpires?: boolean;
}): Promise<GenerateTokenResponse> {
  const response = await post<{ success: boolean; data: GenerateTokenResponse }>('/admin/token', params);
  if (response && 'data' in response) {
    return (response as { success: boolean; data: GenerateTokenResponse }).data;
  }
  // Fallback if response is directly the token object
  return response as GenerateTokenResponse;
}

export async function listTokens(): Promise<Token[]> {
  const response = await get<{ success: boolean; data: Token[] }>('/admin/token');
  if (response && 'data' in response) {
    return (response as { success: boolean; data: Token[] }).data || [];
  }
  // Fallback if response is directly an array (shouldn't happen but for safety)
  return Array.isArray(response) ? response : [];
}

export async function revokeToken(tokenId: string): Promise<{ success: boolean; message: string }> {
  if (!tokenId || typeof tokenId !== 'string') {
    throw new ValidationError('Token ID is required and must be a string');
  }
  return post<{ success: boolean; message: string }>(`/admin/token/${tokenId}/revoke`);
}

export async function deleteToken(tokenId: string): Promise<{ success: boolean; message: string }> {
  if (!tokenId || typeof tokenId !== 'string') {
    throw new ValidationError('Token ID is required and must be a string');
  }
  return del<{ success: boolean; message: string }>(`/admin/token/${tokenId}`);
}
