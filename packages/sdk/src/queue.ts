import { post, get } from './http';
import { getConfig, log } from './config';
import type { QueueStatus, JoinQueueResponse, PollOptions } from './types';
import { ValidationError } from './types';

export async function joinQueue(
  eventId: string,
  userId: string,
  options?: { signal?: AbortSignal }
): Promise<JoinQueueResponse> {
  if (!eventId || typeof eventId !== 'string') {
    throw new ValidationError('Event ID is required and must be a string');
  }
  if (!userId || typeof userId !== 'string') {
    throw new ValidationError('User ID is required and must be a string');
  }

  return post<JoinQueueResponse>('/queue/join', { eventId, userId }, options);
}

export async function getQueueStatus(
  eventId: string,
  userId: string,
  options?: { signal?: AbortSignal; timeout?: number }
): Promise<QueueStatus> {
  if (!eventId || typeof eventId !== 'string') {
    throw new ValidationError('Event ID is required and must be a string');
  }
  if (!userId || typeof userId !== 'string') {
    throw new ValidationError('User ID is required and must be a string');
  }

  const cfg = getConfig();
  const timeout = options?.timeout ?? 10000;

  try {
    const data = await get<QueueStatus>(
      `/queue/status?eventId=${encodeURIComponent(eventId)}&userId=${encodeURIComponent(userId)}`,
      {
        signal: options?.signal,
        timeout,
      }
    );

    return {
      state: data.state || 'waiting',
      position: data.position ?? 0,
      total: data.total ?? 0,
      timeRemaining: data.timeRemaining ?? 0,
      activeUsers: data.activeUsers ?? 0,
      waitingUsers: data.waitingUsers ?? 0,
      showWaitingTimer: data.showWaitingTimer ?? false,
      waitingTimerDuration: data.waitingTimerDuration ?? 0,
    };
  } catch (error) {
    log('Error getting queue status, returning default', error);
    return {
      state: 'waiting',
      position: 0,
      total: 0,
      timeRemaining: 0,
      activeUsers: 0,
      waitingUsers: 0,
      showWaitingTimer: false,
      waitingTimerDuration: 0,
    };
  }
}

export function pollStatus(
  eventId: string,
  userId: string,
  onUpdate: (status: QueueStatus) => void,
  options?: PollOptions
): () => void {
  if (!eventId || typeof eventId !== 'string') {
    throw new ValidationError('Event ID is required and must be a string');
  }
  if (!userId || typeof userId !== 'string') {
    throw new ValidationError('User ID is required and must be a string');
  }
  if (typeof onUpdate !== 'function') {
    throw new ValidationError('onUpdate must be a function');
  }

  const cfg = getConfig();
  const intervalMs = options?.intervalMs ?? 2000;
  const signal = options?.signal;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let isPolling = true;

  const poll = async (): Promise<void> => {
    if (!isPolling || signal?.aborted) {
      return;
    }

    try {
      const status = await getQueueStatus(eventId, userId, { signal });
      if (isPolling && !signal?.aborted) {
        onUpdate(status);
      }
    } catch (error) {
      if (options?.onError) {
        options.onError(
          error instanceof Error ? error : new Error(String(error))
        );
      } else {
        log('Error polling queue status', error);
      }
    }
  };

  poll();
  intervalId = setInterval(() => {
    if (!signal?.aborted && isPolling) {
      poll();
    } else {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }
  }, intervalMs);

  return () => {
    isPolling = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}
