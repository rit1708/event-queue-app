import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import * as sdk from '../index';
import type { QueueStatus, JoinQueueResponse, Event } from '../types';

export interface UseQueueManagerOptions {
  eventId?: string;
  userId?: string;
  event?: Event;
  domainId?: string;
  queueId?: string;
  pollInterval?: number;
  autoJoin?: boolean;
  onActive?: (event: Event) => void;
  onRedirect?: (url: string) => void;
}

export interface QueueManagerState {
  queueStatus: QueueStatus | null;
  loading: boolean;
  error: string | null;
  hasJoined: boolean;
  isWaiting: boolean;
  isActive: boolean;
  showModal: boolean;
  waitDialog: {
    open: boolean;
    duration: number;
    remaining: number;
    message: string;
  };
}

export interface QueueManagerActions {
  joinQueue: () => Promise<void>;
  closeModal: () => void;
  openModal: () => void;
  reset: () => void;
}

export function useQueueManager(options: UseQueueManagerOptions = {}) {
  const {
    eventId,
    userId,
    event,
    pollInterval = 2000,
    autoJoin = false,
    onActive,
    onRedirect,
  } = options;

  const effectiveEventId = eventId || event?._id;
  const effectiveUserId = userId || (() => 'user-' + Math.random().toString(36).slice(2, 10))();

  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [hasRedirected, setHasRedirected] = useState(false);
  const [waitDialog, setWaitDialog] = useState({
    open: false,
    duration: 0,
    remaining: 0,
    message: '',
  });

  const pollingCleanupRef = useRef<(() => void) | null>(null);

  const isWaiting = queueStatus?.state === 'waiting';
  const isActive = queueStatus?.state === 'active';

  // Format domain URL helper
  const formatDomainUrl = useCallback((domain: string): string => {
    if (!domain) return '#';
    if (domain.startsWith('http://') || domain.startsWith('https://')) {
      return domain;
    }
    return `https://${domain}`;
  }, []);

  // Join queue function
  const joinQueue = useCallback(async (): Promise<void> => {
    if (!effectiveEventId || !effectiveUserId) {
      const errorMsg = 'Event ID and User ID are required';
      console.error('Join queue failed:', errorMsg, { effectiveEventId, effectiveUserId });
      setError(errorMsg);
      return;
    }

    try {
      console.log('Attempting to join queue:', { eventId: effectiveEventId, userId: effectiveUserId });
      setLoading(true);
      setError(null);
      const result = await sdk.joinQueue(effectiveEventId, effectiveUserId);
      console.log('Join queue result:', result);
      
      if (result?.success) {
        setHasJoined(true);
        setShowModal(true);
        
        // Handle waiting timer if needed
        if (result.state === 'waiting' && result.showWaitingTimer && result.waitingTimerDuration) {
          const timerDuration = result.waitingTimerDuration || 45;
          setWaitDialog({
            open: true,
            duration: timerDuration,
            remaining: timerDuration,
            message: `Entry limit exceeded. Please wait ${timerDuration} seconds. Position: ${result.position || 0} of ${result.total || 0}`,
          });
        } else if (result.state === 'active') {
          setWaitDialog({ open: false, duration: 0, remaining: 0, message: '' });
        }
      } else if (result?.waitTime) {
        // Legacy handling for wait time
        setHasJoined(true);
        setShowModal(true);
        setWaitDialog({
          open: true,
          duration: result.waitTime,
          remaining: result.waitTime,
          message: result.message ?? 'The queue is currently full. Please wait for the next slot.',
        });
      } else if (result?.message) {
        setError(result.message);
        setWaitDialog({
          open: true,
          duration: 0,
          remaining: 0,
          message: result.message,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join queue';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [effectiveEventId, effectiveUserId]);

  // Close modal handler
  const closeModal = useCallback(() => {
    if (isActive && event && onRedirect) {
      const redirectUrl = formatDomainUrl(event.domain);
      onRedirect(redirectUrl);
    } else if (isActive && event) {
      const redirectUrl = formatDomainUrl(event.domain);
      window.location.href = redirectUrl;
    } else if (!isWaiting && !isActive) {
      // Allow closing if not waiting or active
      setShowModal(false);
      setHasJoined(false);
      setHasRedirected(false);
    }
  }, [isActive, isWaiting, event, onRedirect, formatDomainUrl]);

  // Open modal
  const openModal = useCallback(() => {
    setShowModal(true);
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setQueueStatus(null);
    setLoading(false);
    setError(null);
    setHasJoined(false);
    setShowModal(false);
    setHasRedirected(false);
    setWaitDialog({ open: false, duration: 0, remaining: 0, message: '' });
    if (pollingCleanupRef.current) {
      pollingCleanupRef.current();
      pollingCleanupRef.current = null;
    }
  }, []);

  // Polling effect
  useEffect(() => {
    if (hasJoined && effectiveEventId && effectiveUserId) {
      if (pollingCleanupRef.current) {
        pollingCleanupRef.current();
      }

      const cleanup = sdk.pollStatus(
        effectiveEventId,
        effectiveUserId,
        (status) => {
          setQueueStatus(status);
          setError(null);
        },
        { intervalMs: pollInterval }
      );

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
  }, [hasJoined, effectiveEventId, effectiveUserId, pollInterval]);

  // Handle waiting timer countdown
  useEffect(() => {
    if (!hasJoined || !queueStatus) {
      return;
    }

    if (queueStatus.state === 'active') {
      setWaitDialog({ open: false, duration: 0, remaining: 0, message: '' });
      return;
    }

    if (queueStatus.state === 'waiting') {
      const showTimer = queueStatus.showWaitingTimer && queueStatus.waitingTimerDuration;
      
      if (showTimer) {
        const timerDuration = queueStatus.waitingTimerDuration || 45;
        setWaitDialog((prev) => {
          if (!prev.open || prev.duration !== timerDuration || prev.remaining <= 0) {
            return {
              open: true,
              duration: timerDuration,
              remaining: timerDuration,
              message: `Entry limit exceeded. Please wait ${timerDuration} seconds. Position: ${queueStatus.position} of ${queueStatus.total}`,
            };
          }
          return prev;
        });
      } else {
        setWaitDialog({ open: false, duration: 0, remaining: 0, message: '' });
      }
    }
  }, [hasJoined, queueStatus]);

  // Timer countdown for waiting dialog
  useEffect(() => {
    if (!waitDialog.open || waitDialog.remaining <= 0 || waitDialog.duration !== 45) {
      return;
    }

    const interval = setInterval(() => {
      setWaitDialog((prev) => {
        if (!prev.open || prev.remaining <= 0) {
          return prev;
        }
        return {
          ...prev,
          remaining: Math.max(prev.remaining - 1, 0),
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [waitDialog.open, waitDialog.remaining, waitDialog.duration]);

  // Redirect when user becomes active
  useEffect(() => {
    if (event && isActive && !hasRedirected) {
      setHasRedirected(true);
      
      if (onActive) {
        onActive(event);
      }
      
      if (onRedirect) {
        const redirectUrl = formatDomainUrl(event.domain);
        setTimeout(() => {
          onRedirect(redirectUrl);
        }, 1500);
      } else {
        const redirectUrl = formatDomainUrl(event.domain);
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 1500);
      }
    }
  }, [event, isActive, hasRedirected, onActive, onRedirect, formatDomainUrl]);

  // Auto-join if enabled (only when all required props are available)
  useEffect(() => {
    if (autoJoin && effectiveEventId && effectiveUserId && !hasJoined && !loading) {
      // Small delay to ensure component is fully mounted
      const timeoutId = setTimeout(() => {
        void joinQueue();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [autoJoin, effectiveEventId, effectiveUserId, hasJoined, loading, joinQueue]);

  const state: QueueManagerState = useMemo(
    () => ({
      queueStatus,
      loading,
      error,
      hasJoined,
      isWaiting,
      isActive,
      showModal: showModal && (hasJoined || loading),
      waitDialog,
    }),
    [queueStatus, loading, error, hasJoined, isWaiting, isActive, showModal, waitDialog]
  );

  const actions: QueueManagerActions = useMemo(
    () => ({
      joinQueue,
      closeModal,
      openModal,
      reset,
    }),
    [joinQueue, closeModal, openModal, reset]
  );

  return {
    ...state,
    ...actions,
    eventId: effectiveEventId,
    userId: effectiveUserId,
  };
}

