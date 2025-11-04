import React, { useEffect, useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  People as PeopleIcon,
  Timer as TimerIcon,
  Event as EventIcon,
  Refresh as RefreshIcon,
  PlayArrow as StartIcon,
  SkipNext as AdvanceIcon,
  CheckCircle as ActiveIcon,
  Schedule as WaitingIcon
} from '@mui/icons-material';

const API_URL = 'http://localhost:4000/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `admin-tab-${index}`,
    'aria-controls': `admin-tabpanel-${index}`,
  };
}

interface Event {
  _id: string;
  name: string;
  domain: string;
  queueLimit: number;
  intervalSec: number;
  isActive?: boolean;
}

function AdminApp() {
  // State management
  const [tabValue, setTabValue] = useState(0);
  const [domain, setDomain] = useState('demo.com');
  const [eventName, setEventName] = useState('');
  const [queueLimit, setQueueLimit] = useState(2);
  const [intervalSec, setIntervalSec] = useState(30);
  const [eventId, setEventId] = useState('');
  const [msg, setMsg] = useState('');
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const [waitingUsers, setWaitingUsers] = useState<string[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [remaining, setRemaining] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Event handlers
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const loadUsers = async () => {
    if (!eventId) return;
    try {
      const response = await fetch(`${API_URL}/admin/event/users?eventId=${eventId}`);
      const data = await response.json();
      setActiveUsers(data.active || []);
      setWaitingUsers(data.waiting || []);
    } catch (error) {
      console.error('Failed to load users:', error);
      setMsg('Failed to load users');
    }
  };

  const loadEvents = async (): Promise<void> => {
    try {
      const response = await fetch(`${API_URL}/events`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
        if (data.length > 0 && !eventId) {
          setEventId(data[0]._id);
        }
      } else {
        console.error('Failed to fetch events');
      }
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  // Load users when event changes
  useEffect(() => {
    loadUsers();
  }, [eventId]);

  // API functions
  const createDomain = async () => {
    if (!domain) {
      setMsg('Please provide a domain name');
      return;
    }
    
    setMsg('Creating domain...');
    try {
      const response = await fetch(`${API_URL}/admin/domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: domain.replace(/^https?:\/\//, '').split('/')[0], // Extract domain name
          domain: domain
        })
      });
      const data = await response.json();
      if (response.ok) {
        setMsg(`Domain ${domain} created successfully`);
        // Refresh events list
        const eventsResponse = await fetch(`${API_URL}/events`);
        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json();
          setEvents(eventsData);
        }
      } else {
        setMsg(`Error: ${data.error || 'Failed to create domain'}`);
      }
    } catch (error) {
      console.error('Error creating domain:', error);
      setMsg('Failed to create domain');
    }
  };

  const createEvent = async () => {
    if (!eventName || !domain) {
      setMsg('Please provide event name and domain');
      return;
    }
    
    setMsg('Creating event...');
    try {
      const response = await fetch(`${API_URL}/admin/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: eventName,
          domain,
          queueLimit,
          intervalSec
        })
      });
      const data = await response.json();
      if (response.ok) {
        setMsg(`Event ${eventName} created successfully`);
        // Refresh events list
        const eventsResponse = await fetch(`${API_URL}/events`);
        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json();
          setEvents(eventsData);
        }
      } else {
        setMsg(`Error: ${data.error || 'Failed to create event'}`);
      }
    } catch (error) {
      console.error('Error creating event:', error);
      setMsg('Failed to create event');
    }
  };

  const updateConfig = async () => {
    if (!selectedEvent) return;
    
    setMsg('Updating configuration...');
    try {
      const response = await fetch(`${API_URL}/admin/event/${selectedEvent._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queueLimit,
          intervalSec
        })
      });
      const data = await response.json();
      if (response.ok) {
        setMsg('Configuration updated successfully');
        // Update selected event
        setSelectedEvent(prev => prev ? { ...prev, queueLimit, intervalSec } : null);
      } else {
        setMsg(`Error: ${data.error || 'Failed to update configuration'}`);
      }
    } catch (error) {
      console.error('Error updating configuration:', error);
      setMsg('Failed to update configuration');
    }
  };

  const startWindow = async () => {
    if (!selectedEvent) return;
    
    setMsg('Starting queue window...');
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/admin/event/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: selectedEvent._id })
      });
      const data = await response.json();
      if (response.ok) {
        setMsg('Queue window started');
        // Update selected event
        setSelectedEvent(prev => prev ? { ...prev, isActive: true } : null);
        // Refresh users after starting
        loadUsers();
      } else {
        setMsg(`Error: ${data.error || 'Failed to start queue window'}`);
      }
    } catch (error) {
      console.error('Error starting queue window:', error);
      setMsg('Failed to start queue window');
    } finally {
      setIsLoading(false);
    }
  };

  const advanceNow = async () => {
    if (!selectedEvent) return;
    
    setMsg('Advancing queue...');
    try {
      const response = await fetch(`${API_URL}/admin/event/${selectedEvent._id}/advance`, {
        method: 'POST'
      });
      const data = await response.json();
      if (response.ok) {
        setMsg('Queue advanced');
        // Refresh users
        const usersResponse = await fetch(`${API_URL}/admin/event/users?eventId=${selectedEvent._id}`);
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          setActiveUsers(usersData.active || []);
          setWaitingUsers(usersData.waiting || []);
        }
      } else {
        setMsg(`Error: ${data.error || 'Failed to advance queue'}`);
      }
    } catch (error) {
      console.error('Error advancing queue:', error);
      setMsg('Failed to advance queue');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <EventIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Queue Management System - Admin
          </Typography>
          {selectedEvent && (
            <Chip
              icon={<PeopleIcon />}
              label={`${activeUsers.length} Active / ${waitingUsers.length} Waiting`}
              color="secondary"
              variant="outlined"
              sx={{ mr: 2 }}
            />
          )}
          <Button 
            color="inherit" 
            startIcon={<RefreshIcon />} 
            onClick={() => {
              if (eventId) loadUsers();
              loadEvents();
            }}
          >
            Refresh
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 3, mb: 5, flex: 1 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            aria-label="admin tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Queue Management" {...a11yProps(0)} />
            <Tab label="Event Settings" {...a11yProps(1)} />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    <EventIcon color="primary" sx={{ mr: 1 }} />
                    Select Event
                  </Typography>
                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel>Event</InputLabel>
                    <Select
                      value={eventId}
                      label="Event"
                      onChange={(e) => {
                        const selected = events.find(evt => evt._id === e.target.value);
                        setSelectedEvent(selected || null);
                        setEventId(e.target.value as string);
                      }}
                    >
                      {events.map((event) => (
                        <MenuItem key={event._id} value={event._id}>
                          {event.name} ({event.domain})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {selectedEvent && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Domain:</strong> {selectedEvent.domain}<br />
                        <strong>Queue Limit:</strong> {selectedEvent.queueLimit || queueLimit} users<br />
                        <strong>Interval:</strong> {selectedEvent.intervalSec || intervalSec} seconds
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    <TimerIcon color="primary" sx={{ mr: 1 }} />
                    Queue Controls
                  </Typography>
                  <Stack spacing={2}>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<StartIcon />}
                      onClick={startWindow}
                      disabled={!eventId || isLoading || (selectedEvent?.isActive === true)}
                      fullWidth
                    >
                      {isLoading ? 'Processing...' : 'Start Queue'}
                    </Button>
                    <Button
                      variant="outlined"
                      color="secondary"
                      startIcon={<AdvanceIcon />}
                      onClick={advanceNow}
                      disabled={!eventId || isLoading}
                      fullWidth
                    >
                      Advance Queue
                    </Button>
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                      <Typography variant="h6" color={remaining > 0 ? 'primary' : 'textSecondary'}>
                        {remaining > 0 ? `${remaining}s remaining` : 'Queue not active'}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={8}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    <PeopleIcon color="primary" sx={{ mr: 1 }} />
                    Queue Status
                  </Typography>
                  
                  <Typography variant="subtitle1" sx={{ mt: 1, mb: 2, color: 'primary.main' }}>
                    Active Users ({activeUsers.length})
                  </Typography>
                  <List dense sx={{ bgcolor: 'action.hover', borderRadius: 1, mb: 3, p: 1 }}>
                    {activeUsers.length > 0 ? (
                      activeUsers.map((userId, index) => (
                        <React.Fragment key={userId}>
                          <ListItem>
                            <ActiveIcon color="success" sx={{ mr: 1 }} />
                            <ListItemText 
                              primary={userId} 
                              secondary={`Position: ${index + 1}`} 
                            />
                            <ListItemSecondaryAction>
                              <Chip 
                                label="Active" 
                                size="small" 
                                color="success" 
                                variant="outlined"
                              />
                            </ListItemSecondaryAction>
                          </ListItem>
                          {index < activeUsers.length - 1 && <Divider component="li" />}
                        </React.Fragment>
                      ))
                    ) : (
                      <ListItem>
                        <ListItemText primary="No active users" />
                      </ListItem>
                    )}
                  </List>

                  <Typography variant="subtitle1" sx={{ mt: 3, mb: 2, color: 'warning.main' }}>
                    Waiting Users ({waitingUsers.length})
                  </Typography>
                  <List dense sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1 }}>
                    {waitingUsers.length > 0 ? (
                      waitingUsers.map((userId, index) => (
                        <React.Fragment key={userId}>
                          <ListItem>
                            <WaitingIcon color="warning" sx={{ mr: 1 }} />
                            <ListItemText 
                              primary={userId} 
                              secondary={`Position: ${activeUsers.length + index + 1}`} 
                            />
                            <ListItemSecondaryAction>
                              <Chip 
                                label="Waiting" 
                                size="small" 
                                color="warning" 
                                variant="outlined"
                              />
                            </ListItemSecondaryAction>
                          </ListItem>
                          {index < waitingUsers.length - 1 && <Divider component="li" />}
                        </React.Fragment>
                      ))
                    ) : (
                      <ListItem>
                        <ListItemText primary="No users waiting" />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Create New Event
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      label="Domain"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      fullWidth
                      size="small"
                    />
                    <Button 
                      variant="outlined" 
                      onClick={createDomain}
                      disabled={!domain}
                    >
                      Create Domain
                    </Button>
                    <TextField
                      label="Event Name"
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      fullWidth
                      size="small"
                    />
                    <TextField
                      label="Queue Limit"
                      type="number"
                      value={queueLimit}
                      onChange={(e) => setQueueLimit(Number(e.target.value))}
                      fullWidth
                      size="small"
                    />
                    <TextField
                      label="Interval (seconds)"
                      type="number"
                      value={intervalSec}
                      onChange={(e) => setIntervalSec(Number(e.target.value))}
                      fullWidth
                      size="small"
                    />
                    <Button 
                      variant="contained" 
                      onClick={createEvent}
                      disabled={!eventName || !domain}
                      fullWidth
                    >
                      Create Event
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Update Event Settings
                  </Typography>
                  {selectedEvent ? (
                    <Stack spacing={2}>
                      <TextField
                        label="Queue Limit"
                        type="number"
                        value={queueLimit}
                        onChange={(e) => setQueueLimit(Number(e.target.value))}
                        fullWidth
                        size="small"
                      />
                      <TextField
                        label="Interval (seconds)"
                        type="number"
                        value={intervalSec}
                        onChange={(e) => setIntervalSec(Number(e.target.value))}
                        fullWidth
                        size="small"
                      />
                      <Button 
                        variant="contained" 
                        color="primary"
                        onClick={updateConfig}
                        fullWidth
                      >
                        Update Settings
                      </Button>
                    </Stack>
                  ) : (
                    <Typography color="text.secondary">
                      Select an event to update its settings
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Container>

      {msg && (
        <Paper 
          elevation={3} 
          sx={{ 
            position: 'fixed', 
            bottom: 16, 
            right: 16, 
            p: 2, 
            minWidth: 300,
            bgcolor: 'background.paper',
            borderLeft: '4px solid',
            borderColor: msg.includes('Error') ? 'error.main' : 'success.main'
          }}
        >
          <Typography variant="body2">{msg}</Typography>
          <Button 
            size="small" 
            onClick={() => setMsg('')}
            sx={{ mt: 1 }}
          >
            Dismiss
          </Button>
        </Paper>
      )}
    </Box>
  );
}

export default AdminApp;
