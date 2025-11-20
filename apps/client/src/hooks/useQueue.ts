import { useState, useCallback, useRef, useEffect } from 'react';
import * as sdk from 'queue-sdk';
import type { QueueStatus } from 'queue-sdk';
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

  const joinQueue = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const result = await sdk.joinQueue(eventId, userId);
      logger.debug('Joined queue', result);
      return result.success;
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      logger.error('Failed to join queue', err);
      return false;
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

    const cleanup = sdk.pollStatus(eventId, userId, (status) => {
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

