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
  redirectUrl?: string;
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
    domainId,
    pollInterval = 2000,
    autoJoin = false,
    onActive,
    onRedirect,
    redirectUrl,
  } = options;

  const effectiveEventId = eventId || event?._id;
  const effectiveUserId =
    userId || (() => 'user-' + Math.random().toString(36).slice(2, 10))();

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
  const errorPopupShownRef = useRef(false);
  const waitDialogSetRef = useRef(false);
  const modalOpenedRef = useRef(false);
  const isJoiningRef = useRef(false); // Prevent multiple concurrent join requests
  const lastRequestTimeRef = useRef<number>(0); // Track last request time for debouncing
  const requestIdRef = useRef<string | null>(null); // Track request ID for deduplication
  const abortControllerRef = useRef<AbortController | null>(null); // Abort controller for request cancellation

  const isWaiting = queueStatus?.state === 'waiting';
  const isActive = queueStatus?.state === 'active';

  // Format domain URL helper
  const eventDomain = event?.domain ?? '';

  const formatDomainUrl = useCallback((domain?: string): string => {
    const value = domain?.trim();
    if (!value) return '#';
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    return `https://${value}`;
  }, []);

  const resolveRedirectTarget = useCallback(() => {
    if (redirectUrl) {
      return formatDomainUrl(redirectUrl);
    }
    return formatDomainUrl(eventDomain);
  }, [redirectUrl, eventDomain, formatDomainUrl]);

  // Join queue function
  const joinQueue = useCallback(async (): Promise<void> => {
    const now = Date.now();
    const DEBOUNCE_MS = 3000; // Minimum 3 seconds between requests (increased for better protection)

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Prevent multiple concurrent requests - strict check
    if (isJoiningRef.current || loading) {
      console.log('Join queue already in progress, skipping...', {
        isJoining: isJoiningRef.current,
        loading,
      });
      return;
    }

    // Debounce: Prevent requests within 3 seconds of last request
    const timeSinceLastRequest = now - lastRequestTimeRef.current;
    if (timeSinceLastRequest < DEBOUNCE_MS && lastRequestTimeRef.current > 0) {
      console.log(
        `Join queue debounced: ${timeSinceLastRequest}ms since last request (min ${DEBOUNCE_MS}ms)`
      );
      return;
    }

    if (!effectiveEventId || !effectiveUserId) {
      const errorMsg = 'Event ID and User ID are required';
      console.error('Join queue failed:', errorMsg, {
        effectiveEventId,
        effectiveUserId,
      });
      setError(errorMsg);
      return;
    }

    // Generate unique request ID for deduplication (rounded to nearest second to catch rapid duplicates)
    const requestId = `${effectiveEventId}-${effectiveUserId}-${Math.floor(now / 1000)}`;

    // Check if this is a duplicate request (within same second)
    if (requestIdRef.current === requestId) {
      console.log('Duplicate request detected (same second), skipping...');
      return;
    }

    try {
      // Create new abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Set joining flag and request tracking
      isJoiningRef.current = true;
      lastRequestTimeRef.current = now;
      requestIdRef.current = requestId;

      // Get domain from event if available
      const domain = event?.domain || domainId || null;

      console.log('Attempting to join queue:', {
        eventId: effectiveEventId,
        userId: effectiveUserId,
        domain,
        requestId,
      });
      setLoading(true);
      setError(null);
      errorPopupShownRef.current = false; // Reset error popup flag
      waitDialogSetRef.current = false; // Reset wait dialog flag
      modalOpenedRef.current = false; // Reset modal opened flag
      const result = await sdk.joinQueue(
        effectiveEventId,
        effectiveUserId,
        domain || undefined,
        { signal: abortController.signal }
      );
      console.log('Join queue result:', result);

      if (result?.success) {
        setHasJoined(true);
        // Only set modal if not already opened
        if (!modalOpenedRef.current) {
          modalOpenedRef.current = true;
          setShowModal(true);
        }
        waitDialogSetRef.current = true;

        // Handle waiting timer if needed
        if (
          result.state === 'waiting' &&
          result.showWaitingTimer &&
          result.waitingTimerDuration
        ) {
          const timerDuration = result.waitingTimerDuration || 45;
          setWaitDialog({
            open: true,
            duration: timerDuration,
            remaining: timerDuration,
            message: `Entry limit exceeded. Please wait ${timerDuration} seconds. Position: ${result.position || 0} of ${result.total || 0}`,
          });
        } else if (result.state === 'active') {
          setWaitDialog({
            open: false,
            duration: 0,
            remaining: 0,
            message: '',
          });
        }
      } else if (result?.waitTime) {
        // Legacy handling for wait time
        setHasJoined(true);
        // Only set modal if not already opened
        if (!modalOpenedRef.current) {
          modalOpenedRef.current = true;
          setShowModal(true);
        }
        waitDialogSetRef.current = true;
        setWaitDialog({
          open: true,
          duration: result.waitTime,
          remaining: result.waitTime,
          message:
            result.message ??
            'The queue is currently full. Please wait for the next slot.',
        });
      } else if (result?.message) {
        setError(result.message);
        // Only show error popup if not already shown
        if (!errorPopupShownRef.current) {
          errorPopupShownRef.current = true;
          setWaitDialog({
            open: true,
            duration: 0,
            remaining: 0,
            message: result.message,
          });
        }
      }
    } catch (err) {
      // Handle validation errors with specific messages
      let errorMessage = 'Failed to join queue';

      if (err instanceof Error) {
        errorMessage = err.message;

        // Check for specific validation errors
        if (
          err.message.includes('Domain not validated') ||
          err.message.includes('domain')
        ) {
          errorMessage = 'Domain not validated';
        } else if (
          err.message.includes('Event not exist') ||
          (err.message.includes('Event') && err.message.includes('not found'))
        ) {
          errorMessage = 'Event not exist';
        }
      }

      setError(errorMessage);

      // Show error popup only once and open modal if not already opened
      if (!errorPopupShownRef.current) {
        errorPopupShownRef.current = true;
        if (!modalOpenedRef.current) {
          modalOpenedRef.current = true;
          setShowModal(true);
        }
        setWaitDialog({
          open: true,
          duration: 0,
          remaining: 0,
          message: errorMessage,
        });
      }
    } finally {
      setLoading(false);
      isJoiningRef.current = false; // Reset joining flag
      // Keep requestIdRef to prevent immediate duplicate, but allow new requests after debounce
    }
  }, [effectiveEventId, effectiveUserId, event, domainId, loading]);

  // Close modal handler
  const closeModal = useCallback(() => {
    if (isActive && (event || redirectUrl)) {
      const targetUrl = resolveRedirectTarget();
      if (onRedirect) {
        onRedirect(targetUrl);
      } else if (targetUrl && targetUrl !== '#') {
        window.location.href = targetUrl;
      }
    } else if (!isWaiting && !isActive) {
      // Allow closing if not waiting or active
      setShowModal(false);
      setHasJoined(false);
      setHasRedirected(false);
      modalOpenedRef.current = false;
    }
  }, [
    isActive,
    isWaiting,
    event,
    onRedirect,
    resolveRedirectTarget,
    redirectUrl,
  ]);

  // Open modal
  const openModal = useCallback(() => {
    setShowModal(true);
  }, []);

  // Reset state
  const reset = useCallback(() => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setQueueStatus(null);
    setLoading(false);
    setError(null);
    setHasJoined(false);
    setShowModal(false);
    setHasRedirected(false);
    setWaitDialog({ open: false, duration: 0, remaining: 0, message: '' });
    errorPopupShownRef.current = false;
    waitDialogSetRef.current = false;
    modalOpenedRef.current = false;
    isJoiningRef.current = false; // Reset joining flag
    lastRequestTimeRef.current = 0; // Reset last request time
    requestIdRef.current = null; // Reset request ID
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

    // Don't update waitDialog if error popup is showing
    if (
      errorPopupShownRef.current &&
      waitDialog.message &&
      waitDialog.duration === 0
    ) {
      return;
    }

    if (queueStatus.state === 'active') {
      setWaitDialog({ open: false, duration: 0, remaining: 0, message: '' });
      waitDialogSetRef.current = false;
      return;
    }

    if (queueStatus.state === 'waiting') {
      const showTimer =
        queueStatus.showWaitingTimer && queueStatus.waitingTimerDuration;

      if (showTimer) {
        const timerDuration = queueStatus.waitingTimerDuration || 45;
        setWaitDialog((prev) => {
          // Only update if not already set or if duration changed
          if (
            !waitDialogSetRef.current ||
            prev.duration !== timerDuration ||
            prev.remaining <= 0
          ) {
            waitDialogSetRef.current = true;
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
        // Only clear if it was set by this effect
        if (waitDialogSetRef.current) {
          setWaitDialog({
            open: false,
            duration: 0,
            remaining: 0,
            message: '',
          });
          waitDialogSetRef.current = false;
        }
      }
    }
  }, [hasJoined, queueStatus, waitDialog.message, waitDialog.duration]);

  // Timer countdown for waiting dialog
  useEffect(() => {
    if (
      !waitDialog.open ||
      waitDialog.remaining <= 0 ||
      waitDialog.duration !== 45
    ) {
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
    if ((event || redirectUrl) && isActive && !hasRedirected) {
      setHasRedirected(true);

      if (onActive && event) {
        onActive(event);
      }

      const targetUrl = resolveRedirectTarget();
      const triggerRedirect = () => {
        if (onRedirect) {
          onRedirect(targetUrl);
        } else if (targetUrl && targetUrl !== '#') {
          window.location.href = targetUrl;
        }
      };

      if (targetUrl && targetUrl !== '#') {
        setTimeout(triggerRedirect, 1500);
      }
    }
  }, [
    event,
    isActive,
    hasRedirected,
    onActive,
    onRedirect,
    resolveRedirectTarget,
    redirectUrl,
  ]);

  // Auto-join if enabled (only when all required props are available)
  useEffect(() => {
    if (
      autoJoin &&
      effectiveEventId &&
      effectiveUserId &&
      !hasJoined &&
      !loading &&
      !isJoiningRef.current
    ) {
      // Small delay to ensure component is fully mounted
      const timeoutId = setTimeout(() => {
        if (!isJoiningRef.current && !loading) {
          void joinQueue();
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [
    autoJoin,
    effectiveEventId,
    effectiveUserId,
    hasJoined,
    loading,
    joinQueue,
  ]);

  const state: QueueManagerState = useMemo(
    () => ({
      queueStatus,
      loading,
      error,
      hasJoined,
      isWaiting,
      isActive,
      // Only show modal if hasJoined or loading, and prevent multiple opens
      showModal: showModal && (hasJoined || loading),
      waitDialog,
    }),
    [
      queueStatus,
      loading,
      error,
      hasJoined,
      isWaiting,
      isActive,
      showModal,
      waitDialog,
    ]
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

  useEffect(() => {
    if (
      !waitDialog.open ||
      waitDialog.remaining > 0 ||
      waitDialog.duration === 0
    ) {
      return;
    }
    if (hasRedirected || !queueStatus || queueStatus.state !== 'waiting') {
      return;
    }

    setHasRedirected(true);
    const targetUrl = resolveRedirectTarget();
    if (targetUrl && targetUrl !== '#') {
      if (onRedirect) {
        onRedirect(targetUrl);
      } else {
        window.location.href = targetUrl;
      }
    }
  }, [
    waitDialog.open,
    waitDialog.remaining,
    waitDialog.duration,
    queueStatus,
    hasRedirected,
    resolveRedirectTarget,
    onRedirect,
  ]);

  return {
    ...state,
    ...actions,
    eventId: effectiveEventId,
    userId: effectiveUserId,
  };
}
