import React, { useMemo, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  Chip,
  Stack,
  CircularProgress,
} from '@mui/material';
import {
  HourglassEmpty as HourglassEmptyIcon,
  AccessTime as AccessTimeIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import type { Event } from '../types';
import { useQueueManager } from './useQueueManager';

export interface QueueJoinModalProps {
  eventId?: string;
  domainId?: string;
  queueId?: string;
  userId?: string;
  event?: Event;
  open?: boolean;
  onClose?: () => void;
  onActive?: (event: Event) => void;
  onRedirect?: (url: string) => void;
  pollInterval?: number;
  autoJoin?: boolean;
  showCloseButton?: boolean;
  showCancelButton?: boolean;
  cancelButtonText?: string;
  closeButtonText?: string;
  redirectUrl?: string;
}

export function QueueJoinModal({
  eventId,
  domainId,
  queueId,
  userId,
  event,
  open: controlledOpen,
  onClose: controlledOnClose,
  onActive,
  onRedirect,
  pollInterval,
  autoJoin = false,
  showCloseButton = true,
  showCancelButton = true,
  cancelButtonText = 'Cancel',
  closeButtonText = 'Close',
  redirectUrl,
}: QueueJoinModalProps) {
  const queueManager = useQueueManager({
    eventId,
    userId,
    event,
    domainId,
    queueId,
    pollInterval,
    autoJoin,
    onActive,
    onRedirect,
    redirectUrl,
  });

  const {
    queueStatus,
    loading,
    error,
    isWaiting,
    isActive,
    showModal,
    waitDialog,
    closeModal,
    joinQueue,
    hasJoined,
  } = queueManager;

  // Track if we've attempted to auto-join
  const autoJoinAttemptedRef = useRef(false);

  // Use controlled open if provided, otherwise use internal state
  // If autoJoin is enabled, modal should be open when component mounts
  const isOpen = controlledOpen !== undefined 
    ? controlledOpen 
    : (autoJoin ? true : showModal);
  const handleClose = controlledOnClose || closeModal;

  // Trigger auto-join when modal opens with autoJoin enabled
  useEffect(() => {
    if (autoJoin && eventId && userId && isOpen && !hasJoined && !loading && !autoJoinAttemptedRef.current) {
      console.log('Auto-join triggered:', { eventId, userId, isOpen, hasJoined, loading });
      autoJoinAttemptedRef.current = true;
      // Small delay to ensure modal is rendered
      const timeoutId = setTimeout(() => {
        console.log('Calling joinQueue...');
        void joinQueue();
      }, 150);
      return () => clearTimeout(timeoutId);
    }
    // Reset when modal closes
    if (!isOpen) {
      autoJoinAttemptedRef.current = false;
    }
  }, [autoJoin, eventId, userId, isOpen, hasJoined, loading, joinQueue]);

  const waitProgress = useMemo(() => {
    if (!waitDialog.open || waitDialog.duration === 0) {
      return 0;
    }
    const elapsed = waitDialog.duration - waitDialog.remaining;
    return Math.min(100, Math.max(0, (elapsed / waitDialog.duration) * 100));
  }, [waitDialog]);

  const entryProgress = useMemo(() => {
    if (!queueStatus || !event || queueStatus.timeRemaining <= 0) {
      return 0;
    }
    return ((event.intervalSec - queueStatus.timeRemaining) / event.intervalSec) * 100;
  }, [queueStatus, event]);

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      aria-labelledby="queue-join-dialog-title"
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={isWaiting || isActive}
    >
      <DialogTitle id="queue-join-dialog-title" sx={{ textAlign: 'center' }}>
        {loading && !queueStatus
          ? 'Joining Queue...'
          : isActive
          ? "You're In!"
          : isWaiting
          ? 'Waiting in Queue'
          : 'Queue Status'}
      </DialogTitle>
      <DialogContent sx={{ textAlign: 'center', py: 3 }}>
        {loading && !queueStatus ? (
          <Box>
            <CircularProgress size={48} />
            <Typography variant="body1" sx={{ mt: 2 }}>
              Joining the queue...
            </Typography>
          </Box>
        ) : error ? (
          <Box>
            <Typography variant="body1" color="error" sx={{ mb: 2 }}>
              {error}
            </Typography>
            {!hasJoined && (
              <Button
                variant="contained"
                onClick={() => {
                  autoJoinAttemptedRef.current = false;
                  void joinQueue();
                }}
                disabled={loading}
              >
                {loading ? 'Joining...' : 'Try Again'}
              </Button>
            )}
          </Box>
        ) : !hasJoined && !loading && !autoJoinAttemptedRef.current ? (
          <Box>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Ready to join the queue?
            </Typography>
            <Button
              variant="contained"
              onClick={() => {
                autoJoinAttemptedRef.current = true;
                void joinQueue();
              }}
              disabled={loading}
            >
              Join Queue
            </Button>
          </Box>
        ) : queueStatus && (isWaiting || isActive) ? (
          <>
            <Box sx={{ mb: 3 }}>
              {isActive ? (
                <CheckCircleIcon sx={{ fontSize: 72, color: 'success.main', mb: 2 }} />
              ) : (
                <HourglassEmptyIcon sx={{ fontSize: 72, color: 'warning.main', mb: 2 }} />
              )}
              <Typography variant="h5" fontWeight="bold" gutterBottom>
                {isActive
                  ? "Welcome! You're now in the queue."
                  : `Position: ${queueStatus.position} of ${queueStatus.total}`}
              </Typography>
              <Chip
                label={isActive ? 'Active' : `${queueStatus.waitingUsers} waiting`}
                color={isActive ? 'success' : 'warning'}
                sx={{ mt: 1, fontWeight: 600 }}
              />
            </Box>

            {/* 45-second Waiting Timer - Only shown when entry limit is exceeded */}
            {isWaiting &&
              queueStatus.showWaitingTimer &&
              waitDialog.open &&
              waitDialog.remaining > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="h3"
                    align="center"
                    sx={{ fontWeight: 700, mb: 1, color: 'warning.main' }}
                  >
                    {waitDialog.remaining}s
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                      mb: 2,
                    }}
                  >
                    <AccessTimeIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      Waiting timer - Entry limit exceeded
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={waitProgress}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  {queueStatus.total > 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontWeight: 600 }}>
                      Your position: {queueStatus.position} / {queueStatus.total}
                    </Typography>
                  )}
                </Box>
              )}

            {/* Entry Timer - Shows time remaining for entry window */}
            {!queueStatus.showWaitingTimer && queueStatus.timeRemaining > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography
                  variant="h3"
                  align="center"
                  sx={{ fontWeight: 700, mb: 1, color: 'primary.main' }}
                >
                  {Math.floor(queueStatus.timeRemaining / 60)}:
                  {(queueStatus.timeRemaining % 60).toString().padStart(2, '0')}
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    mb: 2,
                  }}
                >
                  <AccessTimeIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {isActive ? 'Time remaining' : 'Time until next slot'}
                  </Typography>
                </Box>
                {event && (
                  <LinearProgress
                    variant="determinate"
                    value={entryProgress}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                )}
              </Box>
            )}

            {/* Queue progress bar for waiting */}
            {isWaiting && queueStatus.total > 0 && (
              <Box sx={{ width: '100%', mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Queue Progress
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {queueStatus.position} / {queueStatus.total}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(queueStatus.position / queueStatus.total) * 100}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            )}

            {/* Additional stats */}
            <Stack spacing={1.5} sx={{ mt: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Active Users
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  {queueStatus.activeUsers}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Waiting Users
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  {queueStatus.waitingUsers}
                </Typography>
              </Box>
            </Stack>

            {isActive && event && (
              <Box sx={{ mt: 3, p: 2, bgcolor: 'success.light', borderRadius: 2 }}>
                <Typography variant="body2" color="success.dark">
                  Redirecting to <strong>{event.domain}</strong>...
                </Typography>
              </Box>
            )}
          </>
        ) : waitDialog.message ? (
          <>
            {waitDialog.duration > 0 && (
              <>
                <Typography
                  variant="h2"
                  align="center"
                  sx={{ fontWeight: 700, mb: 1, color: 'primary.main' }}
                >
                  {waitDialog.remaining}s
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    mb: 2,
                  }}
                >
                  <AccessTimeIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Next slot opens in {waitDialog.remaining} seconds
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={waitProgress}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </>
            )}
            {waitDialog.message && (
              <Typography variant="body1" sx={{ mb: 2 }}>
                {waitDialog.message}
              </Typography>
            )}
          </>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
        {!isWaiting && !isActive && showCloseButton && (
          <Button onClick={handleClose}>{closeButtonText}</Button>
        )}
        {(isWaiting || isActive) && showCancelButton && (
          <Button variant="outlined" onClick={handleClose}>
            {isActive ? 'Go Now' : cancelButtonText}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

