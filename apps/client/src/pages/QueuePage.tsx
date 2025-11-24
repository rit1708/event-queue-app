import { useState } from 'react';
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
import {
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { QueueJoinModal, useQueueManager } from 'queue-sdk';
import { ErrorDisplay } from '../components/common/ErrorDisplay';
import type { Event } from 'queue-sdk';

interface QueuePageProps {
  event: Event;
  userId: string;
  onBack: () => void;
}

export const QueuePage = ({ event, userId, onBack }: QueuePageProps) => {
  // Use SDK queue manager to handle all queue logic
  const queueManager = useQueueManager({
    eventId: event._id,
    userId,
    event,
    pollInterval: 2000,
  });

  const handleJoinQueue = async () => {
    await queueManager.joinQueue();
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
        {/* Always show join screen in background */}
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h4" gutterBottom fontWeight="bold">
            {queueManager.hasJoined ? 'You\'re in the Queue!' : 'Join Queue'}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            {queueManager.hasJoined
              ? 'Check the popup to see your queue status and position.'
              : 'Click the button below to join the queue for this event'}
          </Typography>
          {queueManager.queueStatus &&
            queueManager.queueStatus.state === 'waiting' && (
              <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
                Current position: {queueManager.queueStatus.position} /{' '}
                {queueManager.queueStatus.total}
              </Typography>
            )}
          {queueManager.error && <ErrorDisplay message={queueManager.error} fullWidth />}
          {!queueManager.hasJoined && (
            <Button
              variant="contained"
              size="large"
              onClick={handleJoinQueue}
              disabled={queueManager.loading}
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
        cancelButtonText="Leave Queue"
        onRedirect={(url) => {
          window.location.href = url;
        }}
      />
    </Box>
  );
};

