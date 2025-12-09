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
  accessToken?: string; // Optional access token to override SDK token
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
    accessToken,
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

  // If an explicit accessToken is provided, set it in the SDK immediately
  useEffect(() => {
    if (accessToken && accessToken.trim().length > 0) {
      const trimmed = accessToken.trim();
      const current = sdk.getToken();
      if (current !== trimmed) {
        sdk.setToken(trimmed);
      }
    }
  }, [accessToken]);

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

  // Local countdown for interval timer (timeRemaining) - for smooth UI countdown
  const [localTimeRemaining, setLocalTimeRemaining] = useState<number | null>(null);

  // Create display queue status with local countdown
  const displayQueueStatus = useMemo(() => {
    if (!queueStatus) return null;
    return {
      ...queueStatus,
      timeRemaining: localTimeRemaining !== null ? localTimeRemaining : queueStatus.timeRemaining,
    };
  }, [queueStatus, localTimeRemaining]);

  const isWaiting = displayQueueStatus?.state === 'waiting';
  const isActive = displayQueueStatus?.state === 'active';

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

      // CRITICAL: Ensure token is set from accessToken prop before calling joinQueue
      if (accessToken && accessToken.trim().length > 0) {
        const trimmed = accessToken.trim();
        const current = sdk.getToken();
        if (current !== trimmed) {
          sdk.setToken(trimmed);
          console.log('Token set from accessToken prop before joinQueue');
        }
      }

      // Verify token is available before making request
      const tokenBeforeRequest = sdk.getToken();
      if (!tokenBeforeRequest || tokenBeforeRequest.trim().length === 0) {
        const errorMsg = 'Token is required but not found. Please set token using sdk.setToken() or pass accessToken prop.';
        console.error('Join queue failed:', errorMsg);
        setError(errorMsg);
        setLoading(false);
        isJoiningRef.current = false;
        return;
      }

      console.log('Attempting to join queue:', {
        eventId: effectiveEventId,
        userId: effectiveUserId,
        domain,
        requestId,
        hasToken: !!tokenBeforeRequest,
        tokenLength: tokenBeforeRequest.length,
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
      console.log('Join result data:', {
        state: result.state,
        position: result.position,
        total: result.total,
        timeRemaining: result.timeRemaining,
        activeUsers: result.activeUsers,
        waitingUsers: result.waitingUsers,
        showWaitingTimer: result.showWaitingTimer,
      });

      if (result?.success) {
        setHasJoined(true);
        // Only set modal if not already opened
        if (!modalOpenedRef.current) {
          modalOpenedRef.current = true;
          setShowModal(true);
        }
        waitDialogSetRef.current = true;

        // Set initial queue status from join result - ensure all fields are set
        const initialStatus: QueueStatus = {
          state: result.state || 'waiting',
          position: result.position ?? 0,
          total: result.total ?? 0,
          timeRemaining: result.timeRemaining ?? 0,
          activeUsers: result.activeUsers ?? 0,
          waitingUsers: result.waitingUsers ?? 0,
          showWaitingTimer: result.showWaitingTimer ?? false,
          waitingTimerDuration: result.waitingTimerDuration ?? 0,
        };
        console.log('Setting initial queue status:', initialStatus);
        setQueueStatus(initialStatus);
        
        // Initialize local countdown timer from API response
        if (result.timeRemaining !== undefined && result.timeRemaining !== null) {
          setLocalTimeRemaining(result.timeRemaining);
          console.log('Initialized localTimeRemaining:', result.timeRemaining);
        }

        // Handle waiting timer if needed
        if (
          result.state === 'waiting' &&
          result.showWaitingTimer &&
          result.waitingTimerDuration
        ) {
          const timerDuration = result.waitingTimerDuration || (event?.intervalSec ?? 45);
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
        
        // Set initial queue status from legacy result
        const initialStatus: QueueStatus = {
          state: result.state || 'waiting',
          position: result.position ?? 0,
          total: result.total ?? 0,
          timeRemaining: result.timeRemaining ?? 0,
          activeUsers: result.activeUsers ?? 0,
          waitingUsers: result.waitingUsers ?? 0,
          showWaitingTimer: result.showWaitingTimer ?? false,
          waitingTimerDuration: result.waitingTimerDuration ?? 0,
        };
        setQueueStatus(initialStatus);
        
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
  }, [effectiveEventId, effectiveUserId, event, domainId, loading, accessToken]);

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
    // Stop polling if redirected
    if (hasRedirected) {
      if (pollingCleanupRef.current) {
        pollingCleanupRef.current();
        pollingCleanupRef.current = null;
      }
      return;
    }
    
    if (hasJoined && effectiveEventId && effectiveUserId) {
      if (pollingCleanupRef.current) {
        pollingCleanupRef.current();
      }

      const cleanup = sdk.pollStatus(
        effectiveEventId,
        effectiveUserId,
        (status) => {
          console.log('Polling status update:', status);
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
  }, [hasJoined, effectiveEventId, effectiveUserId, pollInterval, hasRedirected]);

  // Handle waiting timer countdown
  useEffect(() => {
    if (!hasJoined || !displayQueueStatus) {
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

    if (displayQueueStatus.state === 'active') {
      setWaitDialog({ open: false, duration: 0, remaining: 0, message: '' });
      waitDialogSetRef.current = false;
      return;
    }

    if (displayQueueStatus.state === 'waiting') {
      const showTimer =
        displayQueueStatus.showWaitingTimer && displayQueueStatus.waitingTimerDuration;

      if (showTimer) {
        const timerDuration = displayQueueStatus.waitingTimerDuration || (event?.intervalSec ?? 45);
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
              message: `Entry limit exceeded. Please wait ${timerDuration} seconds. Position: ${displayQueueStatus.position ?? 0} of ${displayQueueStatus.total ?? 0}`,
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
  }, [hasJoined, displayQueueStatus, waitDialog.message, waitDialog.duration]);

  // Timer countdown for waiting dialog
  useEffect(() => {
    if (
      !waitDialog.open ||
      waitDialog.remaining <= 0 ||
      waitDialog.duration <= 0
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

  // Sync local countdown with API value
  useEffect(() => {
    // Don't sync if we've already redirected - prevent timer restart
    if (hasRedirected) {
      return;
    }
    
    if (queueStatus) {
      // Sync local countdown with API value, but only update if API value is higher (to prevent jumping back)
      if (localTimeRemaining === null) {
        setLocalTimeRemaining(queueStatus.timeRemaining);
      } else if (queueStatus.timeRemaining > localTimeRemaining + 2) {
        // API value is significantly higher, sync to it (timer was reset)
        setLocalTimeRemaining(queueStatus.timeRemaining);
      } else if (queueStatus.timeRemaining === 0 && localTimeRemaining > 0) {
        // API says timer is done, but local still counting - keep counting down
        // Don't reset, let it count to 0
      } else if (localTimeRemaining === 0) {
        // Timer has reached 0, don't sync anymore - redirect will happen
        return;
      }
    }
  }, [queueStatus?.timeRemaining, localTimeRemaining, hasRedirected]);

  // Countdown timer for interval - counts down every second
  useEffect(() => {
    // Stop countdown if redirected
    if (hasRedirected) {
      return;
    }
    
    if (localTimeRemaining === null || localTimeRemaining <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setLocalTimeRemaining((prev) => {
        if (prev === null || prev <= 0) {
          return 0;
        }
        const newValue = prev - 1;
        return newValue;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [localTimeRemaining, hasRedirected]);

  // Redirect logic:
  // 1. If user is active and timeRemaining is 0 (entered directly, queue available) -> redirect immediately
  // 2. If user is active and timeRemaining > 0 (queue was full, interval timer running) -> wait for timer to complete
  useEffect(() => {
    if ((event || redirectUrl) && isActive && !hasRedirected) {
      // Get current time remaining value
      const timeRemainingValue = localTimeRemaining ?? displayQueueStatus?.timeRemaining ?? -1;
      
      // If timeRemaining is 0 or less, redirect (either entered directly or interval completed)
      if (timeRemainingValue <= 0) {
        console.log('Redirecting user - interval completed or entered directly', {
          timeRemainingValue,
          localTimeRemaining,
          displayTimeRemaining: displayQueueStatus?.timeRemaining,
          state: displayQueueStatus?.state,
        });
        
        // Mark as redirected immediately to prevent timer restart
        setHasRedirected(true);
        
        // Stop polling immediately
        if (pollingCleanupRef.current) {
          pollingCleanupRef.current();
          pollingCleanupRef.current = null;
        }

        if (onActive && event) {
          onActive(event);
        }

        const targetUrl = resolveRedirectTarget();
        const triggerRedirect = () => {
          console.log('Redirecting to:', targetUrl);
          if (onRedirect) {
            onRedirect(targetUrl);
          } else if (targetUrl && targetUrl !== '#') {
            window.location.href = targetUrl;
          }
        };

        if (targetUrl && targetUrl !== '#') {
          // Small delay to show completion state (or immediate if entered directly)
          const delay = timeRemainingValue === 0 ? 500 : 1000; // Faster redirect if entered directly
          setTimeout(triggerRedirect, delay);
        }
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
    localTimeRemaining,
    displayQueueStatus?.timeRemaining,
    displayQueueStatus?.state,
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
      queueStatus: displayQueueStatus,
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
      displayQueueStatus,
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

  // Redirect when waiting timer completes
  useEffect(() => {
    if (
      !waitDialog.open ||
      waitDialog.remaining > 0 ||
      waitDialog.duration === 0
    ) {
      return;
    }
    // When waiting timer completes, redirect user to the expected route
    if (hasRedirected) {
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
