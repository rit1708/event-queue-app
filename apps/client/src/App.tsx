import React, { useEffect, useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Toolbar,
  Card,
  CardActionArea,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  LinearProgress,
  Snackbar,
  Typography,
} from '@mui/material';
import { 
  Event as EventIcon, 
  People as PeopleIcon, 
  Timer as TimerIcon,
  HourglassEmpty as HourglassEmptyIcon
} from '@mui/icons-material';
import { CircularProgress } from '@mui/material';

const API_URL = 'http://localhost:4000/api';

interface QueueStatus {
  state: 'waiting' | 'active' | 'completed';
  position: number;
  total: number;
  timeRemaining: number;
  activeUsers: number;
  waitingUsers: number;
}

interface Event {
  _id: string;
  name: string;
  domain: string;
  queueLimit: number;
  intervalSec: number;
  isActive: boolean;
}

// Simple SDK implementation
const sdk = {
  baseUrl: API_URL,

  init: (opts: { baseUrl: string }) => {
    sdk.baseUrl = opts.baseUrl.replace(/\/$/, '');
  },

  getEvents: async (): Promise<Event[]> => {
    const response = await fetch(`${sdk.baseUrl}/events`);
    if (!response.ok) throw new Error('Failed to fetch events');
    return response.json();
  },

  joinQueue: async (eventId: string, userId: string): Promise<{ success: boolean }> => {
    const response = await fetch(`${sdk.baseUrl}/queue/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, userId }),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to join queue');
    }
    return response.json();
  },

  getQueueStatus: async (eventId: string, userId: string): Promise<QueueStatus> => {
    console.log(`Fetching queue status for event: ${eventId}, user: ${userId}`);
    
    // Add a timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(
        `${sdk.baseUrl}/queue/status?eventId=${eventId}&userId=${userId}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          credentials: 'same-origin',
          signal: controller.signal,
        }
      );
      
      clearTimeout(timeoutId);
      
      console.log('Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      const data = await response.json().catch(e => {
        console.error('Failed to parse JSON response:', e);
        throw new Error('Invalid JSON response from server');
      });
      
      console.log('Queue status response:', data);
      
      // Ensure we have all required fields with defaults
      return {
        state: data.state || 'waiting',
        position: data.position || 0,
        total: data.total || 0,
        timeRemaining: data.timeRemaining || 0,
        activeUsers: data.activeUsers || 0,
        waitingUsers: data.waitingUsers || 0,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error in getQueueStatus:', errorMessage, error);
      
      // Return a default status object in case of error to prevent UI from breaking
      return {
        state: 'waiting',
        position: 0,
        total: 0,
        timeRemaining: 0,
        activeUsers: 0,
        waitingUsers: 0,
      };
    }
  },

  pollStatus: (
    eventId: string,
    userId: string,
    onUpdate: (status: QueueStatus) => void,
    intervalMs: number = 2000
  ): (() => void) => {
    const poll = async () => {
      try {
        const status = await sdk.getQueueStatus(eventId, userId);
        onUpdate({
          ...status,
          total: status.position + 10, // Estimate
          timeRemaining: status.timeRemaining * 1000, // Convert to ms
        });
      } catch (error) {
        console.error('Error polling queue status:', error);
      }
    };

    // Initial poll
    poll();
    const intervalId = setInterval(poll, intervalMs);
    return () => clearInterval(intervalId);
  },
};

export default function App() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [pollingCleanup, setPollingCleanup] = useState<() => void>(() => () => {});
  const [userId] = useState('user-' + Math.random().toString(36).slice(2, 10));
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  useEffect(() => {
    sdk.init({ baseUrl: API_URL });
    fetchEvents();
  }, []);

  useEffect(() => {
    return () => {
      if (pollingCleanup) {
        pollingCleanup();
      }
    };
  }, [pollingCleanup]);

  const fetchEvents = async () => {
    try {
      const data = await sdk.getEvents();
      setEvents(data);
    } catch (error) {
      showError('Failed to fetch events');
    }
  };

  const startQueueUpdates = (eventId: string) => {
    return sdk.pollStatus(
      eventId,
      userId,
      (status) => {
        setQueueStatus(status);
      }
    );
  };

  const [showQueueFull, setShowQueueFull] = useState(false);
  const [queueWaitTime, setQueueWaitTime] = useState(30);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showQueueFull && queueWaitTime > 0) {
      timer = setTimeout(() => {
        setQueueWaitTime(prev => prev - 1);
      }, 1000);
    } else if (showQueueFull && queueWaitTime <= 0) {
      setShowQueueFull(false);
      // Try joining the queue again after the wait time
      if (selectedEvent) {
        joinQueue(selectedEvent._id, false);
      }
    }
    return () => clearTimeout(timer);
  }, [showQueueFull, queueWaitTime]);

  const joinQueue = async (eventId: string, redirectAfterJoin = true) => {
    try {
      const result: any = await sdk.joinQueue(eventId, userId);
      
      if (result.success) {
        // Start polling for updates
        const stopPolling = startQueueUpdates(eventId);
        setPollingCleanup(() => stopPolling);
        
        // If this is a direct join (not from card click), select the event
        if (!redirectAfterJoin) {
          const event = events.find(e => e._id === eventId);
          if (event) setSelectedEvent(event);
        }
        
        return { success: true };
      } else if (result.status === 'waiting') {
        // Show queue full popup
        setQueuePosition(result.position);
        setQueueWaitTime(result.waitTime);
        setShowQueueFull(true);
        return { success: false, isQueueFull: true };
      }
      
      return { success: false };
    } catch (error) {
      console.error('Error joining queue:', error);
      showError('Failed to join queue');
      return { success: false, error };
    }
  };

  const showError = (message: string) => {
    setSnackbar({ open: true, message });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <EventIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Event Queue System
          </Typography>
          <Typography variant="body2">ID: {userId}</Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4, flex: 1 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Available Events
        </Typography>

        <Grid container spacing={3} sx={{ mt: 2 }}>
          {events.map((event) => (
            <Grid item xs={12} sm={6} md={4} key={event._id}>
              <Card>
                <CardActionArea onClick={async () => {
                  try {
                    const result = await joinQueue(event._id, false);
                    if (result.success) {
                      const redirectUrl = `http://${event.domain}?eventId=${event._id}&userId=${userId}`;
                      window.location.href = redirectUrl;
                    }
                  } catch (error) {
                    console.error('Error in event click handler:', error);
                    showError('An error occurred. Please try again.');
                  }
                }}>
                  <CardContent>
                    <Typography variant="h6" component="div">
                      {event.name}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PeopleIcon fontSize="small" />
                        <Typography variant="body2">
                          Position: {queueStatus?.position} of {queueStatus?.total}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PeopleIcon fontSize="small" color="success" />
                        <Typography variant="body2">
                          Active: {queueStatus?.activeUsers}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PeopleIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          Waiting: {queueStatus?.waitingUsers}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                      <TimerIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        {event.intervalSec} sec per batch
                      </Typography>
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Dialog
        open={!!selectedEvent}
        onClose={() => {
          if (pollingCleanup) pollingCleanup();
          setSelectedEvent(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{selectedEvent?.name} - Queue</DialogTitle>
        <DialogContent>
          {queueStatus ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h5" color="primary" gutterBottom>
                {queueStatus.state === 'active' ? 'Your turn!' : 'In Queue'}
              </Typography>
              
              {queueStatus.state === 'waiting' && (
                <>
                  <Typography variant="h2" sx={{ my: 4 }}>
                    #{queueStatus.position}
                  </Typography>
                  <Typography variant="subtitle1" color="text.secondary">
                    in line of {queueStatus.total} people
                  </Typography>
                  <Box sx={{ mt: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Estimated wait time:
                    </Typography>
                    <Typography variant="h5">
                      {formatTime(queueStatus.timeRemaining / 1000)}
                    </Typography>
                  </Box>
                </>
              )}

              {queueStatus.state === 'active' && (
                <Box sx={{ my: 4 }}>
                  <Typography variant="h4" color="success.main">
                    It's your turn!
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 2 }}>
                    You have {formatTime(queueStatus.timeRemaining / 1000)} remaining
                  </Typography>
                </Box>
              )}

              <LinearProgress
                variant="determinate"
                value={
                  queueStatus.state === 'active'
                    ? (queueStatus.timeRemaining / ((selectedEvent?.intervalSec ?? 30) * 1000)) * 100
                    : 0
                }
                sx={{ mt: 4, height: 10, borderRadius: 5 }}
              />
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => selectedEvent && joinQueue(selectedEvent._id)}
              >
                Join Queue
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedEvent(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />

      {/* Queue Full Dialog */}
      <Dialog open={showQueueFull} onClose={() => setShowQueueFull(false)}>
        <DialogTitle>Queue is Full</DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CircularProgress size={60} thickness={4} sx={{ mb: 3 }} />
            <Typography variant="h6" gutterBottom>
              Queue is currently full
            </Typography>
            {queuePosition !== null && (
              <Typography variant="body1" color="text.secondary">
                Your position in queue: <strong>#{queuePosition}</strong>
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Trying again in {queueWaitTime} seconds...
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowQueueFull(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={() => {
              setShowQueueFull(false);
              if (selectedEvent) {
                joinQueue(selectedEvent._id, false);
              }
            }}
          >
            Try Now
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}