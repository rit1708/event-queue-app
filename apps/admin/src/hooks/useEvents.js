import { useState, useEffect, useCallback } from 'react';
import * as sdk from 'queue-sdk';
import { handleApiError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
export const useEvents = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const fetchEvents = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await sdk.getEvents();
            setEvents(data);
            logger.debug('Events fetched successfully', { count: data.length });
        }
        catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            logger.error('Failed to fetch events', err);
        }
        finally {
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
