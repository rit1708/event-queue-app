import React, { useCallback, useEffect, useMemo, useState, memo, useRef } from 'react';
import {
  AppBar,
  Box,
  Button,
  Toolbar,
  Card,
  CardActionArea,
  CardContent,
  Container,
  Tabs,
  Tab,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  LinearProgress,
  Snackbar,
  Typography,
  Chip,
  Avatar,
  Fade,
  Zoom,
  Badge,
  IconButton,
  alpha,
  Paper,
  Stack,
} from '@mui/material';
import { 
  Event as EventIcon, 
  People as PeopleIcon, 
  Timer as TimerIcon,
  HourglassEmpty as HourglassEmptyIcon,
  CheckCircle as CheckCircleIcon,
  AccessTime as AccessTimeIcon,
  TrendingUp as TrendingUpIcon,
  Person as PersonIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  ArrowForward as ArrowForwardIcon,
  Queue as QueueIcon,
  Speed as SpeedIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import { CircularProgress, TextField, styled } from '@mui/material';

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

// Enhanced styled components
const HeroCard = styled(Card)(({ theme }) => ({
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  borderRadius: 24,
  padding: theme.spacing(4),
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.1)',
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 150,
    height: 150,
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.1)',
  },
}));

const EventCard = styled(Card)(({ theme }) => ({
  background: theme.palette.background.paper,
  border: `2px solid ${alpha('#6366f1', 0.1)}`,
  borderRadius: 20,
  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    background: `linear-gradient(90deg, #6366f1, #ec4899)`,
    transform: 'scaleX(0)',
    transformOrigin: 'left',
    transition: 'transform 0.4s ease',
  },
  '&:hover': {
    transform: 'translateY(-12px)',
    boxShadow: `0 24px 48px ${alpha('#6366f1', 0.25)}`,
    border: `2px solid ${alpha('#6366f1', 0.3)}`,
    '&::before': {
      transform: 'scaleX(1)',
    },
  },
}));

const StatBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(2),
  borderRadius: 12,
  background: alpha('#6366f1', 0.05),
  border: `1px solid ${alpha('#6366f1', 0.1)}`,
}));

const QueueStatusCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  borderRadius: 24,
  textAlign: 'center',
  background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
  border: `2px solid ${alpha('#6366f1', 0.1)}`,
}));

// SDK implementation
const sdk = {
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',

  init: function (opts: { baseUrl: string }) {
    sdk.baseUrl = opts.baseUrl.replace(/\/$/, '');
  },

  getEvents: async (): Promise<Event[]> => {
    const response = await fetch(`${sdk.baseUrl}/events`);
    if (!response.ok) throw new Error('Failed to fetch events');
    return response.json();
  },

  createDomain: async (name: string): Promise<{ domainId: string; name: string }> => {
    const response = await fetch(`${sdk.baseUrl}/admin/domain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to create domain');
    }
    return response.json();
  },

  createEvent: async (params: { domain: string; name: string; queueLimit: number; intervalSec: number }) => {
    const response = await fetch(`${sdk.baseUrl}/admin/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to create event');
    }
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
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
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      const data = await response.json().catch(e => {
        throw new Error('Invalid JSON response from server');
      });
      
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
          total: status.position + 10,
          timeRemaining: status.timeRemaining * 1000,
        });
      } catch (error) {
        console.error('Error polling queue status:', error);
      }
    };

    poll();
    const intervalId = setInterval(poll, intervalMs);
    return () => clearInterval(intervalId);
  },
};

function TabPanel(props: { children?: React.ReactNode; index: number; value: number; }) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} id={`client-tabpanel-${index}`} aria-labelledby={`client-tab-${index}`} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const a11yProps = (index: number) => ({ id: `client-tab-${index}`, 'aria-controls': `client-tabpanel-${index}` });

const EventItemCard = memo(function EventItemCard({
  event,
  index,
  onClick,
}: {
  event: Event;
  index: number;
  onClick: (event: Event) => void;
}) {
  return (
    <Grid item xs={12} sm={6} md={4} key={event._id}>
      <Fade in timeout={300 + index * 100}>
        <EventCard>
          <CardActionArea onClick={() => onClick(event)} sx={{ p: 0 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                <Avatar
                  sx={{
                    bgcolor: event.isActive ? 'success.main' : 'grey.300',
                    width: 56,
                    height: 56,
                    mr: 2,
                  }}
                >
                  <EventIcon />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" component="div" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {event.name}
                  </Typography>
                  <Chip
                    label={event.domain}
                    size="small"
                    sx={{
                      bgcolor: alpha('#6366f1', 0.1),
                      color: 'primary.main',
                      fontWeight: 600,
                      height: 22,
                      fontSize: '0.75rem',
                    }}
                  />
                </Box>
                {event.isActive && (
                  <Badge
                    color="success"
                    variant="dot"
                    sx={{ '& .MuiBadge-badge': { right: 8, top: 8 } }}
                  >
                    <Box />
                  </Badge>
                )}
              </Box>

              <Stack spacing={1.5} sx={{ mt: 2 }}>
                <StatBox>
                  <GroupIcon fontSize="small" color="primary" />
                  <Typography variant="body2" color="text.secondary">
                    Limit: <strong>{event.queueLimit}</strong> per batch
                  </Typography>
                </StatBox>
                <StatBox>
                  <TimerIcon fontSize="small" color="primary" />
                  <Typography variant="body2" color="text.secondary">
                    Interval: <strong>{event.intervalSec}s</strong>
                  </Typography>
                </StatBox>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
                  <Chip
                    label={event.isActive ? 'Active' : 'Inactive'}
                    color={event.isActive ? 'success' : 'default'}
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    endIcon={<ArrowForwardIcon />}
                    sx={{ borderRadius: 2 }}
                  >
                    Join
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </CardActionArea>
        </EventCard>
      </Fade>
    </Grid>
  );
});

export default function App() {
  // Debug: Track renders
  const renderCount = useRef(0);
  renderCount.current += 1;
  if (renderCount.current <= 5) {
    console.log(`[Client App] Render #${renderCount.current}`);
  }

  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [userId] = useState(() => 'user-' + Math.random().toString(36).slice(2, 10));
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [newDomain, setNewDomain] = useState('demo.com');
  const [newEventName, setNewEventName] = useState('Demo Event');
  const [newQueueLimit, setNewQueueLimit] = useState<number>(2);
  const [newIntervalSec, setNewIntervalSec] = useState<number>(30);
  const [tabValue, setTabValue] = useState(0);
  const [showQueueFull, setShowQueueFull] = useState(false);
  const [queueWaitTime, setQueueWaitTime] = useState(30);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Use refs instead of state for cleanup functions to avoid re-renders
  const pollingCleanupRef = useRef<(() => void) | null>(null);
  const eventsRef = useRef(events);
  const selectedEventRef = useRef(selectedEvent);
  const joinQueueRef = useRef<((eventId: string, redirectAfterJoin?: boolean) => Promise<any>) | null>(null);

  // Update refs synchronously (no useEffect needed)
  eventsRef.current = events;
  selectedEventRef.current = selectedEvent;

  const showError = useCallback((message: string) => {
    setSnackbar({ open: true, message });
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingCleanupRef.current) {
        pollingCleanupRef.current();
        pollingCleanupRef.current = null;
      }
    };
  }, []);

  // Initialize SDK and fetch events only once on mount
  useEffect(() => {
    console.log('[Client App] Initial mount - fetching events');
    sdk.init({ baseUrl: API_URL });
    
    let isMounted = true;
    const loadEvents = async () => {
      try {
        setLoading(true);
        const data = await sdk.getEvents();
        if (isMounted) {
          setEvents(data);
        }
      } catch (error) {
        if (isMounted) {
          showError('Failed to fetch events');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    loadEvents();
    
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startQueueUpdates = useCallback((eventId: string) => {
    return sdk.pollStatus(
      eventId,
      userId,
      (status) => {
        setQueueStatus(status);
      }
    );
  }, [userId]);

  const joinQueue = useCallback(async (eventId: string, redirectAfterJoin = true) => {
    try {
      const result: any = await sdk.joinQueue(eventId, userId);

      if (result.success) {
        // Cleanup previous polling if exists
        if (pollingCleanupRef.current) {
          pollingCleanupRef.current();
        }
        
        const stopPolling = startQueueUpdates(eventId);
        pollingCleanupRef.current = stopPolling;

        if (!redirectAfterJoin) {
          const event = eventsRef.current.find(e => e._id === eventId);
          if (event) setSelectedEvent(event);
        }

        return { success: true };
      } else if (result.status === 'waiting') {
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
  }, [showError, startQueueUpdates, userId]);

  // Update joinQueue ref synchronously
  joinQueueRef.current = joinQueue;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showQueueFull && queueWaitTime > 0) {
      timer = setTimeout(() => {
        setQueueWaitTime(prev => prev - 1);
      }, 1000);
    } else if (showQueueFull && queueWaitTime <= 0) {
      setShowQueueFull(false);
      if (selectedEventRef.current && joinQueueRef.current) {
        joinQueueRef.current(selectedEventRef.current._id, false);
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showQueueFull, queueWaitTime]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const activeEvents = useMemo(() => events.filter(e => e.isActive).length, [events]);

  const handleEventClick = useCallback(async (event: Event) => {
    try {
      const result = await joinQueue(event._id, false);
      if ((result as any).success) {
        const redirectUrl = `http://${event.domain}?eventId=${event._id}&userId=${userId}`;
        window.location.href = redirectUrl;
      }
    } catch (error) {
      showError('An error occurred. Please try again.');
    }
  }, [joinQueue, showError, userId]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar 
        position="sticky" 
        elevation={0}
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Toolbar sx={{ py: 1.5 }}>
          <QueueIcon sx={{ mr: 2, fontSize: 32 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 700, letterSpacing: 0.5 }}>
            Queue Management System
          </Typography>
          <Chip
            icon={<PersonIcon />}
            label={userId.slice(0, 12)}
            size="small"
            sx={{
              bgcolor: alpha('#fff', 0.2),
              color: 'white',
              fontWeight: 600,
            }}
          />
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4, flex: 1 }}>
        {/* Hero Section */}
        <HeroCard sx={{ mb: 5, position: 'relative', zIndex: 1 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={8}>
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 2, fontSize: { xs: '2rem', md: '2.5rem' } }}>
                Join Events & Manage Queues
              </Typography>
              <Typography variant="h6" sx={{ mb: 3, opacity: 0.9, fontWeight: 400 }}>
                Get in line for your favorite events. Real-time updates and seamless queue management.
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <StatBox>
                  <EventIcon sx={{ color: 'white', fontSize: 24 }} />
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {events.length}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                      Total Events
                    </Typography>
                  </Box>
                </StatBox>
                <StatBox>
                  <CheckCircleIcon sx={{ color: 'white', fontSize: 24 }} />
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {activeEvents}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                      Active Now
                    </Typography>
                  </Box>
                </StatBox>
                <StatBox>
                  <SpeedIcon sx={{ color: 'white', fontSize: 24 }} />
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Fast
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                      Queue System
                    </Typography>
                  </Box>
                </StatBox>
              </Stack>
            </Grid>
            <Grid item xs={12} md={4} sx={{ textAlign: { xs: 'center', md: 'right' } }}>
              <Avatar
                sx={{
                  width: 120,
                  height: 120,
                  mx: 'auto',
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  border: '3px solid rgba(255, 255, 255, 0.3)',
                }}
              >
                <QueueIcon sx={{ fontSize: 60, color: 'white' }} />
              </Avatar>
            </Grid>
          </Grid>
        </HeroCard>

        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          aria-label="client tabs"
          sx={{ 
            mb: 4,
            '& .MuiTab-root': { 
              textTransform: 'none', 
              fontWeight: 600,
              fontSize: '1rem',
              minHeight: 56,
              px: 3,
            },
            '& .Mui-selected': {
              color: 'primary.main',
            },
          }}
          variant="fullWidth"
          indicatorColor="primary"
        >
          <Tab label="Browse Events" icon={<EventIcon />} iconPosition="start" {...a11yProps(0)} />
          <Tab label="Create Event" icon={<TrendingUpIcon />} iconPosition="start" {...a11yProps(1)} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700, mb: 1 }}>
              Available Events
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Select an event to join the queue and get real-time updates
            </Typography>
          </Box>
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={60} />
            </Box>
          ) : events.length === 0 ? (
            <Card sx={{ p: 6, textAlign: 'center' }}>
              <EventIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No events available
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Check back later or create a new event
              </Typography>
            </Card>
          ) : (
            <Grid container spacing={3}>
              {events.map((event, index) => (
                <EventItemCard key={event._id} event={event} index={index} onClick={handleEventClick} />
              ))}
            </Grid>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700, mb: 1 }}>
              Create New Event
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Set up a new event and configure queue settings
            </Typography>
          </Box>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card sx={{ p: 3, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    <EventIcon />
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Create Domain
                  </Typography>
                </Box>
                <Stack spacing={2}>
                  <TextField
                    label="Domain Name"
                    size="medium"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    fullWidth
                    placeholder="example.com"
                    variant="outlined"
                  />
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    onClick={async () => {
                      try {
                        await sdk.createDomain(newDomain.replace(/^https?:\/\//, '').split('/')[0]);
                        setSnackbar({ open: true, message: 'Domain created successfully!' });
                      } catch (e) {
                        setSnackbar({ open: true, message: (e as Error).message || 'Failed to create domain' });
                      }
                    }}
                    sx={{ mt: 1, py: 1.5 }}
                  >
                    Create Domain
                  </Button>
                </Stack>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card sx={{ p: 3, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <Avatar sx={{ bgcolor: 'secondary.main', mr: 2 }}>
                    <TrendingUpIcon />
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Create Event
                  </Typography>
                </Box>
                <Stack spacing={2}>
                  <TextField
                    label="Event Name"
                    size="medium"
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                    fullWidth
                    variant="outlined"
                  />
                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="Queue Limit"
                      type="number"
                      size="medium"
                      value={newQueueLimit}
                      onChange={(e) => setNewQueueLimit(Number(e.target.value))}
                      sx={{ flex: 1 }}
                      variant="outlined"
                    />
                    <TextField
                      label="Interval (sec)"
                      type="number"
                      size="medium"
                      value={newIntervalSec}
                      onChange={(e) => setNewIntervalSec(Number(e.target.value))}
                      sx={{ flex: 1 }}
                      variant="outlined"
                    />
                  </Stack>
                  <Button
                    variant="contained"
                    size="large"
                    color="secondary"
                    fullWidth
                    onClick={async () => {
                      try {
                        await sdk.createEvent({
                          domain: newDomain.replace(/^https?:\/\//, '').split('/')[0],
                          name: newEventName,
                          queueLimit: newQueueLimit,
                          intervalSec: newIntervalSec,
                        });
                        setSnackbar({ open: true, message: 'Event created successfully!' });
                        fetchEvents();
                        setTabValue(0);
                      } catch (e) {
                        setSnackbar({ open: true, message: (e as Error).message || 'Failed to create event' });
                      }
                    }}
                    sx={{ mt: 1, py: 1.5 }}
                  >
                    Create Event
                  </Button>
                </Stack>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Container>

      {/* Enhanced Queue Status Dialog */}
      <Dialog
        open={!!selectedEvent}
        onClose={() => {
          if (pollingCleanupRef.current) {
            pollingCleanupRef.current();
            pollingCleanupRef.current = null;
          }
          setSelectedEvent(null);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle sx={{ 
          background: queueStatus?.state === 'active' 
            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          color: 'white',
          pb: 3,
          pt: 4,
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                {selectedEvent?.name}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Queue Status
              </Typography>
            </Box>
            <IconButton
              onClick={() => {
                if (pollingCleanupRef.current) {
                  pollingCleanupRef.current();
                  pollingCleanupRef.current = null;
                }
                setSelectedEvent(null);
              }}
              sx={{ color: 'white' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 4, textAlign: 'center' }}>
          {queueStatus ? (
            <QueueStatusCard elevation={0}>
              {queueStatus.state === 'waiting' && (
                <Zoom in>
                  <Box>
                    {/* Position Number Display */}
                    <Box sx={{ 
                      position: 'relative',
                      mb: 4,
                    }}>
                      <Box sx={{ 
                        width: 160, 
                        height: 160, 
                        borderRadius: '50%', 
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        boxShadow: '0 16px 32px rgba(99, 102, 241, 0.4)',
                        position: 'relative',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          inset: -4,
                          borderRadius: '50%',
                          padding: 4,
                          background: 'linear-gradient(135deg, #6366f1, #ec4899)',
                          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                          WebkitMaskComposite: 'xor',
                          maskComposite: 'exclude',
                          opacity: 0.3,
                        },
                      }}>
                        <Typography 
                          variant="h1" 
                          sx={{ 
                            color: 'white', 
                            fontWeight: 800, 
                            fontSize: { xs: '3.5rem', sm: '4.5rem' },
                            lineHeight: 1,
                          }}
                        >
                          {queueStatus.position}
                        </Typography>
                      </Box>
                      <Box sx={{
                        position: 'absolute',
                        top: -10,
                        right: '50%',
                        transform: 'translateX(50%)',
                        bgcolor: 'primary.main',
                        color: 'white',
                        px: 2,
                        py: 0.5,
                        borderRadius: 2,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                      }}>
                        Position
                      </Box>
                    </Box>

                    {/* Status Info */}
                    <Box sx={{ mb: 4 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: 'text.primary' }}>
                        You're in the queue
                      </Typography>
                      <Typography variant="body1" color="text.secondary" sx={{ mb: 0.5 }}>
                        {queueStatus.total > 0 ? `${queueStatus.total} people ahead of you` : 'Almost there!'}
                      </Typography>
                      {queueStatus.position > 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          Please wait, we'll notify you when it's your turn
                        </Typography>
                      )}
                    </Box>

                    {/* Wait Time Card */}
                    <Box sx={{ 
                      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)',
                      borderRadius: 4,
                      p: 4,
                      mb: 3,
                      border: `2px solid ${alpha('#6366f1', 0.2)}`,
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        background: 'linear-gradient(90deg, #6366f1, #ec4899)',
                      },
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                        <AccessTimeIcon sx={{ fontSize: 48, color: 'primary.main', mr: 1 }} />
                        <Box>
                          <Typography variant="h3" sx={{ fontWeight: 700, color: 'primary.main', lineHeight: 1 }}>
                            {formatTime(queueStatus.timeRemaining / 1000)}
                          </Typography>
                        </Box>
                      </Box>
                      <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                        Estimated wait time
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        This is an approximate time and may vary
                      </Typography>
                    </Box>

                    {/* Queue Stats */}
                    <Grid container spacing={2} sx={{ mt: 2 }}>
                      <Grid item xs={6}>
                        <Paper 
                          elevation={0}
                          sx={{ 
                            p: 2, 
                            textAlign: 'center',
                            bgcolor: alpha('#10b981', 0.1),
                            border: `1px solid ${alpha('#10b981', 0.2)}`,
                            borderRadius: 2,
                          }}
                        >
                          <PeopleIcon sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
                          <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main', mb: 0.5 }}>
                            {queueStatus.activeUsers}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            Active Now
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={6}>
                        <Paper 
                          elevation={0}
                          sx={{ 
                            p: 2, 
                            textAlign: 'center',
                            bgcolor: alpha('#f59e0b', 0.1),
                            border: `1px solid ${alpha('#f59e0b', 0.2)}`,
                            borderRadius: 2,
                          }}
                        >
                          <HourglassEmptyIcon sx={{ fontSize: 32, color: 'warning.main', mb: 1 }} />
                          <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main', mb: 0.5 }}>
                            {queueStatus.waitingUsers}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            Waiting
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>

                    {/* Progress Indicator */}
                    {queueStatus.total > 0 && (
                      <Box sx={{ mt: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            Queue Progress
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            {Math.round(((queueStatus.total - queueStatus.position) / queueStatus.total) * 100)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={queueStatus.total > 0 ? ((queueStatus.total - queueStatus.position) / queueStatus.total) * 100 : 0}
                          sx={{ 
                            height: 8, 
                            borderRadius: 4,
                            bgcolor: alpha('#6366f1', 0.1),
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 4,
                              background: 'linear-gradient(90deg, #6366f1, #ec4899)',
                            },
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                </Zoom>
              )}

              {queueStatus.state === 'active' && (
                <Zoom in>
                  <Box>
                    <Box sx={{ 
                      width: 140, 
                      height: 140, 
                      borderRadius: '50%', 
                      bgcolor: 'success.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 3,
                      boxShadow: '0 12px 24px rgba(16, 185, 129, 0.3)',
                    }}>
                      <CheckCircleIcon sx={{ fontSize: 80, color: 'white' }} />
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: 'success.main' }}>
                      It's Your Turn!
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                      You have {formatTime(queueStatus.timeRemaining / 1000)} remaining
                    </Typography>
                    <Box sx={{ 
                      bgcolor: alpha('#10b981', 0.1),
                      borderRadius: 3,
                      p: 2,
                      mb: 3,
                    }}>
                      <LinearProgress
                        variant="determinate"
                        value={(queueStatus.timeRemaining / ((selectedEvent?.intervalSec ?? 30) * 1000)) * 100}
                        sx={{ 
                          height: 12, 
                          borderRadius: 6,
                          bgcolor: alpha('#10b981', 0.1),
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 6,
                            bgcolor: 'success.main',
                          },
                        }}
                      />
                    </Box>
                  </Box>
                </Zoom>
              )}
            </QueueStatusCard>
          ) : (
            <Box sx={{ py: 4 }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => selectedEvent && joinQueue(selectedEvent._id)}
                sx={{ px: 4, py: 1.5 }}
              >
                Join Queue
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button 
            onClick={() => {
              if (pollingCleanupRef.current) {
                pollingCleanupRef.current();
                pollingCleanupRef.current = null;
              }
              setSelectedEvent(null);
            }}
            fullWidth
            variant="outlined"
            size="large"
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ '& .MuiSnackbarContent-root': { borderRadius: 2 } }}
      />

      <Dialog 
        open={showQueueFull} 
        onClose={() => setShowQueueFull(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'visible',
          },
        }}
      >
        <DialogTitle sx={{ pb: 2, pt: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <HourglassEmptyIcon sx={{ color: 'warning.main', fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Queue is Full
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 2 }}>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            {/* Circular Progress Indicator */}
            <Box sx={{ position: 'relative', display: 'inline-flex', mb: 4 }}>
              <CircularProgress
                variant="determinate"
                value={(30 - queueWaitTime) / 30 * 100}
                size={100}
                thickness={4.5}
                sx={{
                  color: 'warning.main',
                  transform: 'rotate(-90deg)',
                }}
              />
            </Box>

            {/* Main Status Message */}
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 600, 
                mb: 2,
                color: 'text.primary',
              }}
            >
              Queue is currently full
            </Typography>

            {/* Position Information */}
            {queuePosition !== null && (
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Your position: <strong>#{queuePosition}</strong>
              </Typography>
            )}

            {/* Countdown Message */}
            <Typography variant="body2" color="text.secondary">
              Trying again in <strong>{queueWaitTime}</strong> seconds...
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, gap: 1.5 }}>
          <Button 
            onClick={() => setShowQueueFull(false)}
            variant="text"
            sx={{
              color: 'primary.main',
              fontWeight: 500,
              textTransform: 'none',
              minWidth: 100,
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained"
            onClick={() => {
              setShowQueueFull(false);
              if (selectedEvent) {
                joinQueue(selectedEvent._id, false);
              }
            }}
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              fontWeight: 600,
              textTransform: 'none',
              minWidth: 120,
              '&:hover': {
                bgcolor: 'primary.dark',
              },
            }}
          >
            Try Now
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
