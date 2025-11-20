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
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useQueue } from '../hooks/useQueue';
import { QueueStatus } from '../components/queue/QueueStatus';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
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
  }, [waitDialog.open]);

  const waitProgress = useMemo(() => {
    if (!waitDialog.open || waitDialog.duration === 0) {
      return 0;
    }
    const elapsed = waitDialog.duration - waitDialog.remaining;
    return Math.min(100, Math.max(0, (elapsed / waitDialog.duration) * 100));
  }, [waitDialog]);

  const handleWaitDialogClose = () => {
    setWaitDialog(defaultWaitDialogState);
  };

  const handleJoinQueue = async () => {
    const result = await joinQueue();
    if (!result) {
      return;
    }

    if (result.success) {
      setHasJoined(true);
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
      // surface non-waiting failures to the user
      setWaitDialog({
        open: true,
        duration: 0,
        remaining: 0,
        message: result.message,
      });
    }
  };

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
        {!hasJoined ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h4" gutterBottom fontWeight="bold">
              Join Queue
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Click the button below to join the queue for this event
            </Typography>
            {error && <ErrorDisplay message={error} fullWidth />}
            <Button
              variant="contained"
              size="large"
              onClick={handleJoinQueue}
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? 'Joining...' : 'Join Queue'}
            </Button>
          </Box>
        ) : (
          <Box>
            {loading && !queueStatus ? (
              <LoadingSpinner message="Loading queue status..." />
            ) : error ? (
              <ErrorDisplay message={error} fullWidth />
            ) : (
              <QueueStatus status={queueStatus} loading={loading} />
            )}
          </Box>
        )}
      </Container>

      <Dialog
        open={waitDialog.open}
        onClose={handleWaitDialogClose}
        aria-labelledby="queue-wait-dialog-title"
      >
        <DialogTitle id="queue-wait-dialog-title">Queue Busy</DialogTitle>
        <DialogContent sx={{ minWidth: { xs: 280, sm: 360 } }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {waitDialog.message ||
              'Please wait a moment before trying to join again.'}
          </Typography>
          {waitDialog.duration > 0 && (
            <>
              <Typography
                variant="h2"
                align="center"
                sx={{ fontWeight: 700, mb: 1 }}
              >
                {waitDialog.remaining}s
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', textAlign: 'center', mb: 2 }}
              >
                Next slot opens in {waitDialog.remaining} seconds
              </Typography>
              <LinearProgress
                variant="determinate"
                value={waitProgress}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
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
        </DialogActions>
      </Dialog>
    </Box>
  );
};

