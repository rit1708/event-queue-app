import React, { useEffect, useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import * as sdk from './sdk';

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

export default function AdminPanel() {
  const [tabValue, setTabValue] = useState(0);
  const [events, setEvents] = useState<sdk.Event[]>([]);
  const [queueUsers, setQueueUsers] = useState<{userId: string; position: number; joinedAt: string}[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<sdk.Event | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newEvent, setNewEvent] = useState<Omit<sdk.Event, '_id'>>({ 
    name: '',
    domain: 'default',
    queueLimit: 5,
    intervalSec: 60,
    isActive: false
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const data = await sdk.getEvents();
      setEvents(data);
    } catch (error) {
      showError('Failed to fetch events');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchQueueUsers = async (eventId: string) => {
    try {
      const users = await sdk.getQueueUsers(eventId);
      setQueueUsers(users);
    } catch (error) {
      showError('Failed to fetch queue users');
    }
  };

  const handleCreateEvent = async () => {
    try {
      await sdk.createEvent(newEvent);
      await fetchEvents();
      setIsCreateDialogOpen(false);
      showMessage('Event created successfully');
    } catch (error) {
      showError('Failed to create event');
    }
  };

  const toggleEventStatus = async (event: sdk.Event) => {
    try {
      await sdk.updateQueueStatus(event._id, !event.isActive);
      await fetchEvents();
      showMessage(`Event ${!event.isActive ? 'started' : 'stopped'} successfully`);
    } catch (error) {
      showError('Failed to update event status');
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const showError = (message: string) => {
    setSnackbar({ open: true, message });
  };

  const showMessage = (message: string) => {
    setSnackbar({ open: true, message });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Admin Panel - Queue Management
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="admin tabs">
          <Tab label="Events" />
          <Tab label="Queue Management" disabled={!selectedEvent} />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsCreateDialogOpen(true)}
          >
            Create Event
          </Button>
        </Box>

        {isLoading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            {events.map((event) => (
              <Grid item xs={12} sm={6} md={4} key={event._id}>
                <Card>
                  <CardContent>
                    <Typography variant="h6">{event.name}</Typography>
                    <Typography color="textSecondary" gutterBottom>
                      {event.domain}
                    </Typography>
                    <Typography variant="body2">
                      {event.queueLimit} users per batch • {event.intervalSec}s interval
                    </Typography>
                    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        color={event.isActive ? 'error' : 'success'}
                        startIcon={event.isActive ? <StopIcon /> : <PlayArrowIcon />}
                        onClick={() => toggleEventStatus(event)}
                      >
                        {event.isActive ? 'Stop' : 'Start'}
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          setSelectedEvent(event);
                          setTabValue(1);
                          fetchQueueUsers(event._id);
                        }}
                      >
                        Manage Queue
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {selectedEvent && (
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h5">
                {selectedEvent.name} - Queue Management
                <Typography color={selectedEvent.isActive ? 'success.main' : 'error.main'} component="span" sx={{ ml: 2 }}>
                  {selectedEvent.isActive ? 'Active' : 'Paused'}
                </Typography>
              </Typography>
              <Box>
                <IconButton onClick={() => toggleEventStatus(selectedEvent)}>
                  {selectedEvent.isActive ? <StopIcon color="error" /> : <PlayArrowIcon color="success" />}
                </IconButton>
                <IconButton onClick={() => fetchQueueUsers(selectedEvent._id)}>
                  <RefreshIcon />
                </IconButton>
              </Box>
            </Box>

            <List>
              {queueUsers.length > 0 ? (
                queueUsers.map((user, index) => (
                  <ListItem key={user.userId} divider>
                    <ListItemText
                      primary={`#${index + 1} - ${user.userId}`}
                      secondary={`Joined at: ${new Date(user.joinedAt).toLocaleString()}`}
                    />
                  </ListItem>
                ))
              ) : (
                <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
                  No users in queue
                </Typography>
              )}
            </List>
          </Paper>
        )}
      </TabPanel>

      {/* Create Event Dialog */}
      <Dialog open={isCreateDialogOpen} onClose={() => setIsCreateDialogOpen(false)}>
        <DialogTitle>Create New Event</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Event Name"
              value={newEvent.name}
              onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Domain"
              value={newEvent.domain}
              onChange={(e) => setNewEvent({ ...newEvent, domain: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Queue Limit"
              type="number"
              value={newEvent.queueLimit}
              onChange={(e) =>
                setNewEvent({ ...newEvent, queueLimit: parseInt(e.target.value) || 1 })
              }
              fullWidth
              required
              inputProps={{ min: 1 }}
            />
            <TextField
              label="Interval (seconds)"
              type="number"
              value={newEvent.intervalSec}
              onChange={(e) =>
                setNewEvent({ ...newEvent, intervalSec: parseInt(e.target.value) || 30 })
              }
              fullWidth
              required
              inputProps={{ min: 10 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateEvent}
            variant="contained"
            disabled={!newEvent.name}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
}
