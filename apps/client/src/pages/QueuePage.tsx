import { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Button,
  IconButton,
  AppBar,
  Toolbar,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useQueue } from '../hooks/useQueue';
import { QueueStatus } from '../components/queue/QueueStatus';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorDisplay } from '../components/common/ErrorDisplay';
import type { Event } from 'queue-sdk';

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

  const handleJoinQueue = async () => {
    const success = await joinQueue();
    if (success) {
      setHasJoined(true);
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
    </Box>
  );
};

