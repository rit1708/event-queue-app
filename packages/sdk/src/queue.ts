import { post, get } from './http';
import { getConfig, log, setToken as setConfigToken, loadTokenFromStorage } from './config';
import type { QueueStatus, JoinQueueResponse, PollOptions } from './types';
import { ValidationError } from './types';

export async function joinQueue(
  eventId: string,
  userId: string,
  domain?: string,
  options?: { signal?: AbortSignal; headers?: Record<string, string | null | undefined> }
): Promise<JoinQueueResponse> {
  if (!eventId || typeof eventId !== 'string') {
    throw new ValidationError('Event ID is required and must be a string');
  }
  if (!userId || typeof userId !== 'string') {
    throw new ValidationError('User ID is required and must be a string');
  }

  const cfg = getConfig();
  
  // Get token from config - try multiple sources
  let token = cfg.token;
  
  // If token not in config, try to load from storage (for browser environments)
  if (!token) {
    const storedToken = loadTokenFromStorage();
    if (storedToken) {
      token = storedToken;
      // Update config with token from storage so it's available for future calls
      setConfigToken(token);
      log('JoinQueue: Loaded token from localStorage and updated config');
    }
  }
  
  if (!token) {
    // Always log error even if logging is disabled
    console.error('[QueueSDK] ERROR: No token found in config or storage');
    console.error('[QueueSDK] Config token:', cfg.token ? 'exists' : 'missing');
    console.error('[QueueSDK] Storage token:', loadTokenFromStorage() ? 'exists' : 'missing');
    log('ERROR: No token found in config or storage');
    throw new ValidationError('Token is required. Please set token using sdk.setToken() or ensure token is in localStorage');
  }

  const trimmedToken = token.trim();
  log(`JoinQueue: Token found, length: ${trimmedToken.length}, first 10 chars: ${trimmedToken.substring(0, 10)}...`);

  // CRITICAL: Ensure token is always included in body
  // Build body object step by step to ensure token is never lost
  const body: { eventId: string; userId: string; domain?: string; token: string } = {
    eventId: String(eventId),
    userId: String(userId),
    token: String(trimmedToken), // Include token in payload - THIS IS CRITICAL - MUST BE STRING
  };
  
  // Include domain if provided
  if (domain && typeof domain === 'string' && domain.trim().length > 0) {
    body.domain = domain.trim();
  }
  
  // Triple-check token is in body (safety check)
  if (!body.token || body.token.trim().length === 0) {
    console.error('[QueueSDK] CRITICAL ERROR: Token not included in request body!');
    console.error('[QueueSDK] Body object:', JSON.stringify(body));
    throw new ValidationError('Token was not included in request body. This is a bug.');
  }
  
  // Verify token is a non-empty string
  if (typeof body.token !== 'string' || body.token.length === 0) {
    console.error('[QueueSDK] CRITICAL ERROR: Token is not a valid string!');
    console.error('[QueueSDK] Token type:', typeof body.token, 'Length:', body.token?.length);
    throw new ValidationError('Token must be a non-empty string.');
  }

  // Log the body to verify token is included (but don't log full token for security)
  log('JoinQueue request body prepared:', { 
    eventId, 
    userId, 
    domain: body.domain, 
    hasToken: !!body.token, 
    tokenLength: body.token?.length,
    tokenPreview: body.token ? `${body.token.substring(0, 10)}...` : 'MISSING'
  });

  // Final verification - ensure token is in body before sending
  if (!body.token || body.token.trim().length === 0) {
    console.error('[QueueSDK] CRITICAL: Token missing from body before sending request!');
    console.error('[QueueSDK] Body contents:', JSON.stringify({ ...body, token: 'MISSING' }));
    throw new ValidationError('Token is missing from request body. Cannot proceed.');
  }

  // Log final body (without full token for security)
  console.log('[QueueSDK] Sending joinQueue request with token in payload:', {
    eventId: body.eventId,
    userId: body.userId,
    domain: body.domain,
    hasToken: !!body.token,
    tokenLength: body.token.length,
    tokenPreview: body.token.substring(0, 10) + '...'
  });

  // Don't send token in header for join queue (it's in payload)
  // Explicitly exclude Authorization header by setting it to null
  return post<JoinQueueResponse>('/queue/join', body, {
    ...options,
    headers: {
      Authorization: null, // Explicitly exclude Authorization header
      ...(options?.headers || {}),
    },
  });
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
