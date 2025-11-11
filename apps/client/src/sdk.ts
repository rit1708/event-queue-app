export interface QueueStatus {
  state: 'waiting' | 'active' | 'not_queued';
  position: number;
  total: number;
  timeRemaining: number;
  activeUsers: number;
  waitingUsers: number;
}

export interface Event {
  _id: string;
  name: string;
  domain: string;
  queueLimit: number;
  intervalSec: number;
  isActive: boolean;
  createdAt?: string;
}

export interface ApiError extends Error {
  success: boolean;
  error?: string;
  code?: string;
  message: string;
  status?: number;
  retryAfter?: number;
}

// Get API URL - use relative in dev (Vite proxy) or absolute from env
// const getApiUrl = () => {
//   const envUrl = import.meta.env.VITE_API_URL;
//   if (envUrl) return envUrl;
//   // In development, use relative URL to leverage Vite proxy
//   if (import.meta.env.DEV) {
//     return '/api';
//   }
//   // Production fallback
//   return 'http://localhost:4000/api';
// };

let BASE = 'http://localhost:4000/api';

// Initialize API base URL
export function init(opts: { baseUrl: string }) {
  BASE = opts.baseUrl.replace(/\/$/, '');
}

interface ApiError extends Error {
  status?: number;
  retryAfter?: number;
  message: string;
}

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  const retryAfter = response.headers.get('Retry-After');

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    let errorData: any = {};

    try {
      errorData = isJson ? await response.json() : await response.text();
      
      // Handle rate limiting
      if (response.status === 429) {
        const err = new Error(errorData.message || 'Too many requests') as ApiError;
        err.status = 429;
        err.retryAfter = retryAfter ? parseInt(retryAfter, 10) : 5; // Default to 5 seconds
        throw err;
      }
      
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch (e) {
      // If JSON parsing fails or other errors, use the status text
      errorMessage = errorData.message || response.statusText || errorMessage;
    }

    const error = new Error(errorMessage) as ApiError;
    error.status = response.status;
    if (retryAfter) error.retryAfter = parseInt(retryAfter, 10);
    throw error;
  }

  if (isJson) {
    const data = await response.json();
    // Backend returns data directly for most endpoints, but some wrap it
    // Handle both cases
    if (data && typeof data === 'object') {
      if ('data' in data && 'success' in data) {
        return data.data as T;
      }
      return data as T;
    }
    return data as T;
  }

  return response.text() as unknown as T;
}

// Event related API calls
export async function getEvents(): Promise<Event[]> {
  const response = await fetch(`${BASE}/events`);
  return handleResponse<Event[]>(response);
}

export async function getEvent(eventId: string): Promise<Event> {
  const response = await fetch(`${BASE}/events/${eventId}`);
  return handleResponse<Event>(response);
}

// Queue related API calls
export async function joinQueue(
  eventId: string,
  userId: string
): Promise<QueueStatus> {
  const response = await fetch(`${BASE}/queue/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, userId }),
  });
  return handleResponse<QueueStatus>(response);
}

export async function getQueueStatus(
  eventId: string,
  userId: string
): Promise<QueueStatus> {
  const url = new URL(`${BASE}/queue/status`);
  url.searchParams.set('eventId', eventId);
  url.searchParams.set('userId', userId);

  const response = await fetch(url.toString());
  return handleResponse<QueueStatus>(response);
}

// Admin API calls (for admin panel)
export async function createEvent(eventData: Omit<Event, '_id'>) {
  const response = await fetch(`${BASE}/admin/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventData),
  });
  return handleResponse<Event>(response);
}

export async function updateEvent(eventId: string, updates: Partial<Event>) {
  const response = await fetch(`${BASE}/admin/event/${eventId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return handleResponse<{ success: boolean; data?: Event; message?: string }>(
    response
  );
}

export async function getQueueUsers(eventId: string) {
  const response = await fetch(`${BASE}/admin/event/users?eventId=${eventId}`);
  return handleResponse<{
    active: string[];
    waiting: string[];
    remaining: number;
  }>(response);
}

export async function updateQueueStatus(eventId: string, isActive: boolean) {
  // Use the start/stop endpoints
  const endpoint = isActive ? 'start' : 'stop';
  const response = await fetch(`${BASE}/admin/event/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId }),
  });
  return handleResponse<{ success: boolean; message?: string }>(response);
}

// Domain API calls
export async function createDomain(name: string): Promise<{ domainId: string; name: string }> {
  const response = await fetch(`${BASE}/domains`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const result = await handleResponse<{ success: boolean; data?: { domainId: string; name: string } }>(response);
  if (result.success && result.data) {
    return result.data;
  }
  throw new Error('Failed to create domain');
}
