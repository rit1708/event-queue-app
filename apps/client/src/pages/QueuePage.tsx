import { useState, useCallback, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Button,
  IconButton,
  AppBar,
  Toolbar,
  CircularProgress,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { QueueJoinModal, useQueueManager } from 'queue-sdk';
import * as sdk from 'queue-sdk';
import { ErrorDisplay } from '../components/common/ErrorDisplay';
import type { Event } from 'queue-sdk';

interface QueuePageProps {
  event: Event;
  userId: string;
  onBack: () => void;
}

export const QueuePage = ({ event, userId, onBack }: QueuePageProps) => {
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Initialize SDK with token synchronously BEFORE useQueueManager hook
  // This ensures the token is available when the hook initializes
  const token = '49685bda848d83a35d4570e1975cac8ad71833aeb2f750d83dfb31c561bcf6a4';
  
  // Initialize SDK with token (synchronously, before hook)
  if (!sdk.getToken() || sdk.getToken() !== token) {
    sdk.init({ token });
    // Also save to storage for persistence
    try {
      sdk.saveTokenToStorage?.(token);
    } catch {
      // ignore storage errors
    }
  }

  // Ensure token is persisted and valid (useEffect for side effects)
  useEffect(() => {
    const currentToken = sdk.getToken();
    if (currentToken && typeof currentToken === 'string' && currentToken.trim()) {
      setTokenError(null);
    } else {
      // Re-initialize if token is missing
      sdk.init({ token });
      try {
        sdk.saveTokenToStorage?.(token);
      } catch {
        // ignore storage errors
      }
      setTokenError(null);
    }
  }, [token]);

  // Use SDK queue manager to handle all queue logic
  // Pass token explicitly to ensure it's available
  const queueManager = useQueueManager({
    eventId: event._id,
    userId,
    event,
    pollInterval: 2000,
    accessToken: token,
  });

  const handleJoinQueue = useCallback(async () => {
    // Prevent multiple clicks - check all conditions
    if (queueManager.loading || queueManager.hasJoined) {
      console.log('Join queue blocked:', {
        loading: queueManager.loading,
        hasJoined: queueManager.hasJoined,
      });
      return;
    }

    // Additional guard: prevent rapid clicks with debounce
    try {
      await queueManager.joinQueue();
    } catch (error) {
      // Error is already handled in queueManager
      console.error('Join queue error:', error);
    }
  }, [queueManager.loading, queueManager.hasJoined, queueManager.joinQueue]);

  return (
    <Box>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={onBack}
            sx={{ mr: 2 }}
          >
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
            {queueManager.hasJoined ? "You're in the Queue!" : 'Join Queue'}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            {queueManager.hasJoined
              ? 'Check the popup to see your queue status and position.'
              : 'Click the button below to join the queue for this event'}
          </Typography>
          {tokenError && <ErrorDisplay message={tokenError} fullWidth />}
          {queueManager.queueStatus &&
            queueManager.queueStatus.state === 'waiting' && (
              <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
                Current position: {queueManager.queueStatus.position} /{' '}
                {queueManager.queueStatus.total}
              </Typography>
            )}
          {queueManager.error && (
            <ErrorDisplay message={queueManager.error} fullWidth />
          )}
          {!queueManager.hasJoined && (
            <Button
              variant="contained"
              size="large"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleJoinQueue();
              }}
              disabled={queueManager.loading || queueManager.hasJoined}
              sx={{ mt: 2 }}
            >
              {queueManager.loading ? 'Joining...' : 'Join Queue'}
            </Button>
          )}
          {queueManager.hasJoined && !queueManager.showModal && (
            <Box sx={{ mt: 3 }}>
              <CircularProgress size={48} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Loading queue status...
              </Typography>
            </Box>
          )}
        </Box>
      </Container>

      {/* Queue Status Modal - Managed by SDK */}
      <QueueJoinModal
        eventId={event._id}
        userId={userId}
        event={event}
        open={queueManager.showModal}
        onClose={() => {
          if (!queueManager.isWaiting && !queueManager.isActive) {
            queueManager.reset();
          }
        }}
        accessToken={token}
        cancelButtonText="Leave Queue"
        onRedirect={(url: string) => {
          window.location.href = url;
        }}
      />
    </Box>
  );
};
