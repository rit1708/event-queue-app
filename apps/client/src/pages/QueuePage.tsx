import { useEffect, useMemo, useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Button,
  IconButton,
  AppBar,
  Toolbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  CircularProgress,
  Chip,
  Stack,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  HourglassEmpty as HourglassEmptyIcon,
  AccessTime as AccessTimeIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useQueue } from '../hooks/useQueue';
import { ErrorDisplay } from '../components/common/ErrorDisplay';
import type { Event } from 'queue-sdk';

type WaitDialogState = {
  open: boolean;
  duration: number;
  remaining: number;
  message: string;
};

const defaultWaitDialogState: WaitDialogState = {
  open: false,
  duration: 0,
  remaining: 0,
  message: '',
};

interface QueuePageProps {
  event: Event;
  userId: string;
  onBack: () => void;
}

export const QueuePage = ({ event, userId, onBack }: QueuePageProps) => {
  const [hasJoined, setHasJoined] = useState(false);
  const { queueStatus, loading, error, joinQueue } = useQueue({
    eventId: event._id,
    userId,
    enabled: hasJoined,
  });
  const [waitDialog, setWaitDialog] = useState<WaitDialogState>(defaultWaitDialogState);

  // Timer countdown for wait dialog
  useEffect(() => {
    if (!waitDialog.open || waitDialog.remaining <= 0) {
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
  }, [waitDialog.open, waitDialog.remaining]);

  // Show waiting modal popup when user has joined and is waiting
  useEffect(() => {
    if (hasJoined && queueStatus && queueStatus.state === 'waiting') {
      setWaitDialog({
        open: true,
        duration: queueStatus.timeRemaining || 45,
        remaining: queueStatus.timeRemaining || 45,
        message: `You are in the queue! Position: ${queueStatus.position} of ${queueStatus.total}`,
      });
    } else if (hasJoined && queueStatus && queueStatus.state === 'active') {
      // Close dialog when user becomes active
      setWaitDialog(defaultWaitDialogState);
    }
  }, [hasJoined, queueStatus]);

  // Update wait dialog timer from queueStatus timeRemaining
  useEffect(() => {
    if (
      waitDialog.open &&
      queueStatus &&
      queueStatus.state === 'waiting' &&
      queueStatus.timeRemaining > 0
    ) {
      setWaitDialog((prev) => ({
        ...prev,
        remaining: queueStatus.timeRemaining,
        duration: Math.max(prev.duration, queueStatus.timeRemaining),
      }));
    }
  }, [queueStatus?.timeRemaining, waitDialog.open]);

  const waitProgress = useMemo(() => {
    if (!waitDialog.open || waitDialog.duration === 0) {
      return 0;
    }
    const elapsed = waitDialog.duration - waitDialog.remaining;
    return Math.min(100, Math.max(0, (elapsed / waitDialog.duration) * 100));
  }, [waitDialog]);

  const handleWaitDialogClose = () => {
    // Don't allow closing the dialog when actively waiting in queue
    if (hasJoined && queueStatus?.state === 'waiting') {
      return;
    }
    setWaitDialog(defaultWaitDialogState);
  };

  const handleJoinQueue = async () => {
    const result = await joinQueue();
    if (!result) {
      return;
    }

    if (result.success) {
      setHasJoined(true);
      // Polling will start automatically via enabled prop
      return;
    }

    if (typeof result.waitTime === 'number' && result.waitTime > 0) {
      setWaitDialog({
        open: true,
        duration: result.waitTime,
        remaining: result.waitTime,
        message:
          result.message ??
          'The queue is currently full. Please wait for the next slot.',
      });
      return;
    }

    if (result.message) {
      setWaitDialog({
        open: true,
        duration: 0,
        remaining: 0,
        message: result.message,
      });
    }
  };

  const isActive = queueStatus?.state === 'active';
  const isWaiting = queueStatus?.state === 'waiting';
  const showQueueModal = hasJoined && (isWaiting || isActive);

  return (
    <Box>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {event.name}
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 4 }}>
        {/* Always show join screen in background */}
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h4" gutterBottom fontWeight="bold">
            {hasJoined ? 'You\'re in the Queue!' : 'Join Queue'}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            {hasJoined
              ? 'Check the popup to see your queue status and position.'
              : 'Click the button below to join the queue for this event'}
          </Typography>
          {error && <ErrorDisplay message={error} fullWidth />}
          {!hasJoined && (
            <Button
              variant="contained"
              size="large"
              onClick={handleJoinQueue}
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? 'Joining...' : 'Join Queue'}
            </Button>
          )}
          {hasJoined && !showQueueModal && (
            <Box sx={{ mt: 3 }}>
              <CircularProgress size={48} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Loading queue status...
              </Typography>
            </Box>
          )}
        </Box>
      </Container>

      {/* Queue Status Modal Popup - Shows timer/status for both waiting and active */}
      <Dialog
        open={showQueueModal || waitDialog.open}
        onClose={handleWaitDialogClose}
        aria-labelledby="queue-status-dialog-title"
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={hasJoined && (isWaiting || isActive)}
      >
        <DialogTitle id="queue-status-dialog-title" sx={{ textAlign: 'center' }}>
          {isActive ? 'You\'re In!' : isWaiting ? 'Waiting in Queue' : 'Queue Busy'}
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', py: 3 }}>
          {queueStatus && (isWaiting || isActive) ? (
            <>
              <Box sx={{ mb: 3 }}>
                {isActive ? (
                  <CheckCircleIcon sx={{ fontSize: 72, color: 'success.main', mb: 2 }} />
                ) : (
                  <HourglassEmptyIcon
                    sx={{ fontSize: 72, color: 'warning.main', mb: 2 }}
                  />
                )}
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                  {isActive 
                    ? 'Welcome! You\'re now in the queue.' 
                    : `Position: ${queueStatus.position} of ${queueStatus.total}`}
                </Typography>
                <Chip
                  label={isActive ? 'Active' : `${queueStatus.waitingUsers} waiting`}
                  color={isActive ? 'success' : 'warning'}
                  sx={{ mt: 1, fontWeight: 600 }}
                />
              </Box>

              {/* Timer countdown */}
              {queueStatus.timeRemaining > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="h3"
                    align="center"
                    sx={{ fontWeight: 700, mb: 1, color: 'primary.main' }}
                  >
                    {Math.floor(queueStatus.timeRemaining / 60)}:{(queueStatus.timeRemaining % 60).toString().padStart(2, '0')}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
                    <AccessTimeIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {isActive ? 'Time remaining' : 'Time until next slot'}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={queueStatus.timeRemaining > 0 
                      ? ((event.intervalSec - queueStatus.timeRemaining) / event.intervalSec) * 100 
                      : 0}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
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
            </>
          ) : (
            // Show wait dialog when queue is full (before joining)
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
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
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
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          {!hasJoined && (
            <>
              <Button onClick={handleWaitDialogClose}>
                {waitDialog.duration > 0 ? 'Got it' : 'Close'}
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  handleWaitDialogClose();
                  void handleJoinQueue();
                }}
                disabled={waitDialog.duration > 0 && waitDialog.remaining > 0}
              >
                Try Again
              </Button>
            </>
          )}
          {(isWaiting || isActive) && (
            <Button variant="outlined" onClick={onBack}>
              Leave Queue
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

