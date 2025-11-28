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
        if (!loading) {
          console.log('Calling joinQueue...');
          void joinQueue();
        }
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
                  if (!loading) {
                    autoJoinAttemptedRef.current = false;
                    void joinQueue();
                  }
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!loading && !hasJoined) {
                  autoJoinAttemptedRef.current = true;
                  void joinQueue();
                }
              }}
              disabled={loading || hasJoined}
            >
              Join Queue
            </Button>
          </Box>
        ) : queueStatus || hasJoined ? (
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
                  : `Position: ${queueStatus?.position ?? 0} of ${queueStatus?.total ?? 0}`}
              </Typography>
              {!isActive && (
                <Chip
                  label={`${queueStatus?.waitingUsers ?? 0} waiting`}
                  color="warning"
                  sx={{ mt: 1, fontWeight: 600 }}
                />
              )}
              {isActive && (
                <Chip
                  label="Active"
                  color="success"
                  sx={{ mt: 1, fontWeight: 600 }}
                />
              )}
            </Box>

            {/* Active and Waiting Users - Always show prominently */}
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body1" fontWeight={600} color="text.primary">
                    Active Users
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color="success.main">
                    {queueStatus?.activeUsers ?? 0}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body1" fontWeight={600} color="text.primary">
                    Waiting Users
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color="warning.main">
                    {queueStatus?.waitingUsers ?? 0}
                  </Typography>
                </Box>
              </Stack>
            </Box>

            {/* Timer - Always show when queueStatus exists */}
            {queueStatus && (
              <Box sx={{ mb: 3, p: 2, bgcolor: 'primary.light', borderRadius: 2 }}>
                {/* 45-second Waiting Timer */}
                {isWaiting &&
                  queueStatus.showWaitingTimer &&
                  waitDialog.open &&
                  waitDialog.remaining > 0 && (
                    <>
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
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontWeight: 600, textAlign: 'center' }}>
                        Your position: {queueStatus.position || 0} / {queueStatus.total || 0}
                      </Typography>
                    </>
                  )}

                {/* Entry Timer - Shows time remaining for entry window (interval timer) */}
                {(!queueStatus.showWaitingTimer || (!waitDialog.open || waitDialog.remaining <= 0)) && (
                  <>
                    {isActive && queueStatus.timeRemaining > 0 ? (
                      <>
                        <Typography
                          variant="h3"
                          align="center"
                          sx={{ fontWeight: 700, mb: 1, color: 'primary.main' }}
                        >
                          {Math.floor((queueStatus.timeRemaining ?? 0) / 60)}:
                          {((queueStatus.timeRemaining ?? 0) % 60).toString().padStart(2, '0')}
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
                            Waiting for interval to complete...
                          </Typography>
                        </Box>
                        {event && (
                          <LinearProgress
                            variant="determinate"
                            value={entryProgress}
                            sx={{ height: 8, borderRadius: 4 }}
                          />
                        )}
                        {event && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                            Interval: {event.intervalSec}s - You will be redirected when timer completes
                          </Typography>
                        )}
                      </>
                    ) : isActive && queueStatus.timeRemaining === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 2 }}>
                        <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                        <Typography variant="h6" color="success.main" fontWeight="bold">
                          Queue available! Redirecting...
                        </Typography>
                      </Box>
                    ) : event ? (
                      <Box sx={{ textAlign: 'center' }}>
                        <AccessTimeIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                        <Typography variant="h5" fontWeight="bold" color="primary.main" sx={{ mb: 1 }}>
                          {Math.floor(event.intervalSec / 60)}:
                          {(event.intervalSec % 60).toString().padStart(2, '0')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {isActive ? 'Queue window is active' : 'Waiting for next queue window'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Interval: {event.intervalSec}s
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ textAlign: 'center' }}>
                        <AccessTimeIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                        <Typography variant="body2" color="text.secondary">
                          {isActive ? 'Queue window is active' : 'Waiting for next queue window'}
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
              </Box>
            )}

            {/* Queue progress bar for waiting */}
            {isWaiting && queueStatus && (queueStatus.total ?? 0) >= 0 && (
              <Box sx={{ width: '100%', mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Queue Progress
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {queueStatus.position} / {queueStatus.total || 1}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={queueStatus.total > 0 ? (queueStatus.position / queueStatus.total) * 100 : 0}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            )}

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

