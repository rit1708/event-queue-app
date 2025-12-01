import { useState, useEffect, useCallback } from 'react';
import * as sdk from 'queue-sdk';
import type { Event } from 'queue-sdk';
import { handleApiError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

export const useEvents = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Events list doesn't require token - fetch without token check
      const data = await sdk.getEvents();
      setEvents(data);
      logger.debug('Events fetched successfully', { count: data.length });
    } catch (err: any) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      logger.error('Failed to fetch events', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    loading,
    error,
    refetch: fetchEvents,
  };
};


