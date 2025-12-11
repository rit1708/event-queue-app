import { useState, useCallback, useRef, useEffect } from 'react';
import * as sdk from 'queue-sdk';
import type { QueueStatus, JoinQueueResponse } from 'queue-sdk';
import { handleApiError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

interface UseQueueOptions {
  eventId: string;
  userId: string;
  enabled?: boolean;
  pollInterval?: number;
}

export const useQueue = ({ eventId, userId, enabled = true, pollInterval = 2000 }: UseQueueOptions) => {
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingCleanupRef = useRef<(() => void) | null>(null);

  const joinQueue = useCallback(async (): Promise<JoinQueueResponse | null> => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if token exists - required for queue operations
      const token = sdk.getToken() || sdk.loadTokenFromStorage();
      if (!token) {
        const errorMsg = 'API token is required to join the queue. Please set a token using: sdk.setToken("your-token") or via localStorage (queue_api_token key).';
        setError(errorMsg);
        logger.error('Token missing for queue join');
        return null;
      }

      const result = await sdk.joinQueue(eventId, userId);
      logger.debug('Joined queue', result);
      return result;
    } catch (err: any) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      logger.error('Failed to join queue', err);
      
      // If it's a token error, provide helpful message
      if (err.statusCode === 401 || err.message?.includes('token') || err.message?.includes('unauthorized')) {
        const tokenError = 'Invalid or expired token. Please update your API token. You can view events without a token, but joining the queue requires a valid token.';
        setError(tokenError);
        sdk.clearTokenFromStorage();
        sdk.setToken(undefined);
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [eventId, userId]);

  const startPolling = useCallback(() => {
    if (!enabled || !eventId || !userId) return;

    // Cleanup existing polling
    if (pollingCleanupRef.current) {
      pollingCleanupRef.current();
    }

    const cleanup = sdk.pollStatus(eventId, userId, (status: QueueStatus) => {
      setQueueStatus(status);
      setError(null);
    }, { intervalMs: pollInterval });

    pollingCleanupRef.current = cleanup;
  }, [eventId, userId, enabled, pollInterval]);

  const stopPolling = useCallback(() => {
    if (pollingCleanupRef.current) {
      pollingCleanupRef.current();
      pollingCleanupRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (enabled && eventId && userId) {
      if (pollingCleanupRef.current) {
        pollingCleanupRef.current();
      }

      const cleanup = sdk.pollStatus(eventId, userId, (status) => {
        setQueueStatus(status);
        setError(null);
      }, { intervalMs: pollInterval });

      pollingCleanupRef.current = cleanup;
    } else {
      if (pollingCleanupRef.current) {
        pollingCleanupRef.current();
        pollingCleanupRef.current = null;
      }
    }

    return () => {
      if (pollingCleanupRef.current) {
        pollingCleanupRef.current();
        pollingCleanupRef.current = null;
      }
    };
  }, [enabled, eventId, userId, pollInterval]);

  return {
    queueStatus,
    loading,
    error,
    joinQueue,
    startPolling,
    stopPolling,
  };
};

