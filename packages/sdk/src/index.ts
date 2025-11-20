// Queue SDK - Centralized API client for queue management system
// This SDK can be used across multiple projects, ensuring consistency and easy maintenance

export type InitOptions = { baseUrl?: string };

export interface QueueStatus {
  state: 'waiting' | 'active' | 'completed';
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
}

let BASE: string | null = null;
let isInitialized = false;

/**
 * Auto-detect the API base URL from environment or use relative path
 */
function getDefaultBaseUrl(): string {
  // Check for window global (can be set by apps)
  if (typeof window !== 'undefined' && (window as any).__QUEUE_API_URL__) {
    return (window as any).__QUEUE_API_URL__.replace(/\/$/, '');
  }

  // Check for import.meta.env (Vite) - works in browser
  try {
    const metaEnv = (import.meta as any)?.env;
    if (metaEnv?.VITE_API_URL) {
      const url = metaEnv.VITE_API_URL;
      if (url) return url.replace(/\/$/, '');
    }
  } catch {
    // import.meta might not be available in all environments
  }

  // Check for environment variable (works in Node.js)
  if (typeof process !== 'undefined' && process.env?.VITE_API_URL) {
    return process.env.VITE_API_URL.replace(/\/$/, '');
  }

  // Use relative path by default (assumes same origin)
  return '/api';
}

/**
 * Get the current base URL, auto-detecting if not initialized
 */
function getBaseUrlInternal(): string {
  if (BASE === null) {
    BASE = getDefaultBaseUrl();
  }
  return BASE;
}

/**
 * Initialize the SDK with a base URL (optional)
 * If not called, the SDK will auto-detect from environment or use relative paths
 * @param opts Configuration options
 */
export function init(opts?: InitOptions) {
  if (opts?.baseUrl) {
    BASE = opts.baseUrl.replace(/\/$/, '');
  } else {
    BASE = getDefaultBaseUrl();
  }
  isInitialized = true;
}

/**
 * Get the current base URL
 */
export function getBaseUrl(): string {
  return getBaseUrlInternal();
}

// ==================== Event Related Methods ====================

/**
 * Fetch all events
 */
export async function getEvents(): Promise<Event[]> {
  const response = await fetch(`${getBaseUrlInternal()}/events`);
  if (!response.ok) throw new Error('Failed to fetch events');
  return response.json();
}

/**
 * Get a specific event by ID
 */
export async function getEvent(eventId: string): Promise<Event> {
  const response = await fetch(`${getBaseUrlInternal()}/events/${eventId}`);
  if (!response.ok) throw new Error('Failed to fetch event');
  return response.json();
}

// ==================== Queue Related Methods ====================

/**
 * Join a queue for an event
 */
export async function joinQueue(
  eventId: string,
  userId: string
): Promise<{
  success: boolean;
  status?: string;
  position?: number;
  [key: string]: any;
}> {
  const response = await fetch(`${getBaseUrlInternal()}/queue/join`, {
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

/**
 * Get queue status for a user in an event
 */
export async function getQueueStatus(
  eventId: string,
  userId: string
): Promise<QueueStatus> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `${getBaseUrlInternal()}/queue/status?eventId=${eventId}&userId=${userId}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }

    const data = await response.json().catch((e) => {
      throw new Error('Invalid JSON response from server');
    });

    return {
      state: data.state || 'waiting',
      position: data.position || 0,
      total: data.total || 0,
      timeRemaining: data.timeRemaining || 0,
      activeUsers: data.activeUsers || 0,
      waitingUsers: data.waitingUsers || 0,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    // Return default status on error
    return {
      state: 'waiting',
      position: 0,
      total: 0,
      timeRemaining: 0,
      activeUsers: 0,
      waitingUsers: 0,
    };
  }
}

/**
 * Poll queue status at regular intervals
 * @param eventId Event ID
 * @param userId User ID
 * @param onUpdate Callback function called on each update
 * @param intervalMs Polling interval in milliseconds (default: 2000)
 * @returns Cleanup function to stop polling
 */
export function pollStatus(
  eventId: string,
  userId: string,
  onUpdate: (status: QueueStatus) => void,
  intervalMs: number = 2000
): () => void {
  const poll = async () => {
    try {
      const status = await getQueueStatus(eventId, userId);
      onUpdate({
        ...status,
        total: status.position + 10,
        timeRemaining: status.timeRemaining * 1000,
      });
    } catch (error) {
      console.error('Error polling queue status:', error);
    }
  };

  poll();
  const intervalId = setInterval(poll, intervalMs);
  return () => clearInterval(intervalId);
}

// ==================== Admin Methods ====================

/**
 * Create a new domain
 */
export async function createDomain(
  name: string
): Promise<{ domainId: string; name: string }> {
  const response = await fetch(`${getBaseUrlInternal()}/admin/domain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to create domain');
  }
  return response.json();
}

/**
 * Create a new event
 */
export async function createEvent(params: {
  domain: string;
  name: string;
  queueLimit: number;
  intervalSec: number;
}): Promise<Event> {
  const response = await fetch(`${getBaseUrlInternal()}/admin/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to create event');
  }
  return response.json();
}

/**
 * Update an event
 */
export async function updateEvent(
  eventId: string,
  updates: Partial<Event>
): Promise<{ ok: boolean }> {
  const response = await fetch(
    `${getBaseUrlInternal()}/admin/event/${eventId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to update event');
  }
  return response.json();
}

/**
 * Delete an event
 */
export async function deleteEvent(eventId: string): Promise<{ ok: boolean }> {
  const response = await fetch(
    `${getBaseUrlInternal()}/admin/event/${eventId}`,
    {
      method: 'DELETE',
    }
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to delete event');
  }
  return response.json();
}

/**
 * Get queue users for an event (admin only)
 */
export async function getQueueUsers(eventId: string): Promise<{
  active: string[];
  waiting: string[];
  remaining: number;
}> {
  const response = await fetch(
    `${getBaseUrlInternal()}/admin/event/users?eventId=${eventId}`
  );
  if (!response.ok) {
    throw new Error('Failed to get queue users');
  }
  return response.json();
}

/**
 * Update queue status (start/stop event)
 */
export async function updateQueueStatus(
  eventId: string,
  isActive: boolean
): Promise<{ ok: boolean }> {
  const response = await fetch(
    `${getBaseUrlInternal()}/admin/event/${eventId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    }
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to update queue status');
  }
  return response.json();
}

/**
 * Advance queue manually (admin only)
 */
export async function advanceQueue(eventId: string): Promise<{
  ok: boolean;
  moved: string[];
  active: string[];
  waiting: string[];
}> {
  const response = await fetch(
    `${getBaseUrlInternal()}/admin/event/${eventId}/advance`,
    {
      method: 'POST',
    }
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to advance queue');
  }
  return response.json();
}

/**
 * Start queue window (admin only)
 */
export async function startQueue(eventId: string): Promise<{ ok: boolean }> {
  const response = await fetch(`${getBaseUrlInternal()}/admin/event/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to start queue');
  }
  return response.json();
}

/**
 * Stop queue window (admin only)
 */
export async function stopQueue(eventId: string): Promise<{ ok: boolean }> {
  const response = await fetch(`${getBaseUrlInternal()}/admin/event/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to stop queue');
  }
  return response.json();
}

// Export all types and functions as default export for convenience
export default {
  init,
  getBaseUrl,
  getEvents,
  getEvent,
  joinQueue,
  getQueueStatus,
  pollStatus,
  createDomain,
  createEvent,
  updateEvent,
  deleteEvent,
  getQueueUsers,
  updateQueueStatus,
  advanceQueue,
  startQueue,
  stopQueue,
};
