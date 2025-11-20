import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Container,
  Grid,
  Typography,
  Box,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Chip,
  Stack,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  HourglassEmpty as HourglassEmptyIcon,
  AccessTime as AccessTimeIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useEvents } from '../hooks/useEvents';
import { EventCard } from '../components/events/EventCard';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorDisplay } from '../components/common/ErrorDisplay';
import { HeroCard } from '../styles/theme';
import { useQueue } from '../hooks/useQueue';
import * as sdk from 'queue-sdk';
import type { Event } from 'queue-sdk';

interface HomePageProps {
  onEventSelect: (event: Event) => void;
}

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }): JSX.Element {
  return (
    <div role="tabpanel" hidden={value !== index} id={`tabpanel-${index}`} aria-labelledby={`tab-${index}`}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export const HomePage = ({ onEventSelect }: HomePageProps) => {
  const [tabValue, setTabValue] = useState(0);
  const { events, loading, error, refetch } = useEvents();
  const [joinEvent, setJoinEvent] = useState<Event | null>(null);
  const [userId] = useState(() => 'user-' + Math.random().toString(36).slice(2, 10));
  const [hasRedirected, setHasRedirected] = useState(false);

  const [hasJoined, setHasJoined] = useState(false);
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null);
  const { queueStatus, loading: queueLoading, error: queueError, joinQueue } = useQueue({
    eventId: joiningEventId || '',
    userId,
    enabled: hasJoined && !!joiningEventId,
  });

  const activeEvents = useMemo(() => events.filter((e) => e.isActive), [events]);
  const inactiveEvents = useMemo(() => events.filter((e) => !e.isActive), [events]);

  // Format domain URL
  const formatDomainUrl = (domain: string): string => {
    if (!domain) return '#';
    if (domain.startsWith('http://') || domain.startsWith('https://')) {
      return domain;
    }
    return `https://${domain}`;
  };

  // Handle join button click
  const handleJoin = useCallback(async (event: Event) => {
    if (!event.isActive) {
      return;
    }
    setJoinEvent(event);
    setJoiningEventId(event._id);
    setHasRedirected(false);
    setHasJoined(false);
    
    // Use joinQueue from hook - but we need to wait for it to be available
    // So we'll use a ref or call it in useEffect
  }, []);
  
  // Join queue when event is selected
  useEffect(() => {
    if (joinEvent && joiningEventId && !hasJoined) {
      const performJoin = async () => {
        // Create a temporary queue hook instance just for joining
        const result = await sdk.joinQueue(joiningEventId, userId);
        if (result?.success) {
          setHasJoined(true);
          // Polling will start automatically via enabled prop
        } else if (result?.waitTime) {
          // Still show modal even if wait time required
          setHasJoined(true);
        }
      };
      void performJoin();
    }
  }, [joinEvent, joiningEventId, hasJoined, userId]);

  // Redirect when user becomes active
  useEffect(() => {
    if (joinEvent && queueStatus?.state === 'active' && !hasRedirected) {
      setHasRedirected(true);
      const redirectUrl = formatDomainUrl(joinEvent.domain);
      // Small delay to show "You're In!" message
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 1500);
    }
  }, [joinEvent, queueStatus?.state, hasRedirected]);

  // Close modal handler
  const handleCloseModal = () => {
    if (queueStatus?.state === 'active') {
      // If active, redirect immediately
      if (joinEvent) {
        window.location.href = formatDomainUrl(joinEvent.domain);
      }
    } else {
      // If still waiting, allow closing (user can join again later)
      setJoinEvent(null);
      setJoiningEventId(null);
      setHasRedirected(false);
      setHasJoined(false);
    }
  };

  const isWaiting = queueStatus?.state === 'waiting';
  const isActive = queueStatus?.state === 'active';
  const showModal = !!joinEvent && (hasJoined || queueLoading);

  if (loading) {
    return <LoadingSpinner message="Loading events..." fullScreen />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={refetch} fullWidth />;
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <HeroCard sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
          Queue Management System
        </Typography>
        <Typography variant="h6" sx={{ opacity: 0.9 }}>
          Join events and manage your queue position in real-time
        </Typography>
      </HeroCard>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label={`All Events (${events.length})`} />
          <Tab label={`Active (${activeEvents.length})`} />
          <Tab label={`Inactive (${inactiveEvents.length})`} />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          {events.map((event, index) => (
            <EventCard key={event._id} event={event} index={index} onClick={onEventSelect} onJoin={handleJoin} />
          ))}
          {events.length === 0 && (
            <Grid item xs={12}>
              <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                No events available
              </Typography>
            </Grid>
          )}
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          {activeEvents.map((event, index) => (
            <EventCard key={event._id} event={event} index={index} onClick={onEventSelect} onJoin={handleJoin} />
          ))}
          {activeEvents.length === 0 && (
            <Grid item xs={12}>
              <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                No active events
              </Typography>
            </Grid>
          )}
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          {inactiveEvents.map((event, index) => (
            <EventCard key={event._id} event={event} index={index} onClick={onEventSelect} onJoin={handleJoin} />
          ))}
          {inactiveEvents.length === 0 && (
            <Grid item xs={12}>
              <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                No inactive events
              </Typography>
            </Grid>
          )}
        </Grid>
      </TabPanel>

      {/* Join Queue Modal Popup */}
      <Dialog
        open={showModal}
        onClose={handleCloseModal}
        aria-labelledby="queue-join-dialog-title"
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={isWaiting || isActive}
      >
        <DialogTitle id="queue-join-dialog-title" sx={{ textAlign: 'center' }}>
          {queueLoading ? 'Joining Queue...' : isActive ? 'You\'re In!' : isWaiting ? 'Waiting in Queue' : 'Queue Status'}
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', py: 3 }}>
          {queueLoading && !queueStatus ? (
            <Box>
              <CircularProgress size={48} />
              <Typography variant="body1" sx={{ mt: 2 }}>
                Joining the queue...
              </Typography>
            </Box>
          ) : queueError ? (
            <Typography variant="body1" color="error">
              {queueError}
            </Typography>
          ) : queueStatus ? (
            <>
              <Box sx={{ mb: 3 }}>
                {isActive ? (
                  <CheckCircleIcon sx={{ fontSize: 72, color: 'success.main', mb: 2 }} />
                ) : (
                  <HourglassEmptyIcon sx={{ fontSize: 72, color: 'warning.main', mb: 2 }} />
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
                      {isActive ? 'Redirecting in...' : 'Time until next slot'}
                    </Typography>
                  </Box>
                  {joinEvent && (
                    <LinearProgress
                      variant="determinate"
                      value={queueStatus.timeRemaining > 0 
                        ? ((joinEvent.intervalSec - queueStatus.timeRemaining) / joinEvent.intervalSec) * 100 
                        : 0}
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

              {isActive && joinEvent && (
                <Box sx={{ mt: 3, p: 2, bgcolor: 'success.light', borderRadius: 2 }}>
                  <Typography variant="body2" color="success.dark">
                    Redirecting to <strong>{joinEvent.domain}</strong>...
                  </Typography>
                </Box>
              )}
            </>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          {!isWaiting && !isActive && (
            <Button onClick={handleCloseModal}>Close</Button>
          )}
          {(isWaiting || isActive) && (
            <Button variant="outlined" onClick={handleCloseModal}>
              {isActive ? 'Go Now' : 'Cancel'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
};

