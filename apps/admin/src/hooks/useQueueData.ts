import { useState, useEffect, useCallback } from 'react';
import * as sdk from 'queue-sdk';
import type { QueueData, HistoryPoint } from '../types';
import { logger } from '../utils/logger';

interface UseQueueDataOptions {
  eventId: string | null;
  pollInterval?: number;
  enabled?: boolean;
}

export const useQueueData = ({ eventId, pollInterval = 2000, enabled = true }: UseQueueDataOptions) => {
  const [queueData, setQueueData] = useState<QueueData>({
    active: [],
    waiting: [],
    remaining: 0,
  });
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQueueData = useCallback(async () => {
    if (!eventId || !enabled) return;

    try {
      setLoading(true);
      setError(null);
      const data = await sdk.getQueueUsers(eventId);
      
      setQueueData({
        active: data.active || [],
        waiting: data.waiting || [],
        remaining: data.remaining || 0,
      });

      const now = Date.now();
      setHistory((prev) => {
        const next = [
          ...prev,
          {
            t: now,
            active: (data.active || []).length,
            waiting: (data.waiting || []).length,
          },
        ];
        return next.slice(-30); // Keep last 30 points
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue data');
      logger.error('Failed to load queue data', err);
    } finally {
      setLoading(false);
    }
  }, [eventId, enabled]);

  useEffect(() => {
    if (!eventId || !enabled) return;

    fetchQueueData();
    const interval = setInterval(fetchQueueData, pollInterval);
    return () => clearInterval(interval);
  }, [eventId, enabled, pollInterval, fetchQueueData]);

  return {
    queueData,
    history,
    loading,
    error,
    refetch: fetchQueueData,
  };
};

