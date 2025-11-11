import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Drawer,
  Grid,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Chip,
  Avatar,
  alpha,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  CircularProgress,
  Stack,
  LinearProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Event as EventIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  BarChart as BarChartIcon,
  TrendingUp as TrendingUpIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Timer as TimerIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { LineChart, PieChart } from '@mui/x-charts';
import { styled } from '@mui/material/styles';

const API_URL = 'http://localhost:4000/api';

const drawerWidth = 260;

const SidebarDrawer = styled(Drawer)(({ theme }) => ({
  width: drawerWidth,
  flexShrink: 0,
  '& .MuiDrawer-paper': {
    width: drawerWidth,
    boxSizing: 'border-box',
    background: 'linear-gradient(180deg, #1e40af 0%, #1e3a8a 100%)',
    color: 'white',
    borderRight: 'none',
  },
}));

const KPICard = styled(Card)(({ theme }) => ({
  background: theme.palette.background.paper,
  borderRadius: 12,
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
  },
}));

const MainContent = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  backgroundColor: '#f5f7fa',
  minHeight: '100vh',
  padding: theme.spacing(3),
}));

interface Event {
  _id: string;
  name: string;
  domain: string;
  queueLimit: number;
  intervalSec: number;
  isActive?: boolean;
  createdAt?: string;
}

interface QueueData {
  active: string[];
  waiting: string[];
  remaining: number;
}

function AdminApp() {
  const [selectedView, setSelectedView] = useState('dashboard');
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [queueData, setQueueData] = useState<QueueData>({ active: [], waiting: [], remaining: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<{ t: number; active: number; waiting: number }[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [newEvent, setNewEvent] = useState({
    name: '',
    domain: '',
    queueLimit: 2,
    intervalSec: 30,
  });
  const [editEvent, setEditEvent] = useState<Event | null>(null);

  const loadEvents = async () => {
    try {
      const response = await fetch(`${API_URL}/events`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
        if (data.length > 0 && !selectedEvent) {
          setSelectedEvent(data[0]);
        }
      }
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const loadQueueData = async (eventId: string) => {
    if (!eventId) return;
    try {
      const response = await fetch(`${API_URL}/admin/event/users?eventId=${eventId}`);
      const data = await response.json();
      setQueueData({
        active: data.active || [],
        waiting: data.waiting || [],
        remaining: data.remaining || 0,
      });
      
      const now = Date.now();
      setHistory((prev) => {
        const next = [...prev, { 
          t: now, 
          active: (data.active || []).length, 
          waiting: (data.waiting || []).length 
        }];
        return next.slice(-30);
      });
    } catch (error) {
      console.error('Failed to load queue data:', error);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      loadQueueData(selectedEvent._id);
      const interval = setInterval(() => {
        loadQueueData(selectedEvent._id);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [selectedEvent]);

  const startQueue = async () => {
    if (!selectedEvent) return;
    setIsLoading(true);
    try {
      await fetch(`${API_URL}/admin/event/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: selectedEvent._id }),
      });
      loadEvents();
      loadQueueData(selectedEvent._id);
    } catch (error) {
      console.error('Error starting queue:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const stopQueue = async () => {
    if (!selectedEvent) return;
    setIsLoading(true);
    try {
      await fetch(`${API_URL}/admin/event/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: selectedEvent._id }),
      });
      loadEvents();
      loadQueueData(selectedEvent._id);
    } catch (error) {
      console.error('Error stopping queue:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalUsers = queueData.active.length + queueData.waiting.length;
  const activeQueues = events.filter(e => e.isActive).length;
  const totalEvents = events.length;

  const handleCreateEvent = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEvent),
      });
      if (response.ok) {
        setSnackbar({ open: true, message: 'Event created successfully!', severity: 'success' });
        setCreateDialogOpen(false);
        setNewEvent({ name: '', domain: '', queueLimit: 2, intervalSec: 30 });
        loadEvents();
      } else {
        const error = await response.text();
        setSnackbar({ open: true, message: error || 'Failed to create event', severity: 'error' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to create event', severity: 'error' });
    }
  };

  const handleUpdateEvent = async () => {
    if (!editEvent) return;
    try {
      const response = await fetch(`${API_URL}/admin/event/${editEvent._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queueLimit: editEvent.queueLimit,
          intervalSec: editEvent.intervalSec,
        }),
      });
      if (response.ok) {
        setSnackbar({ open: true, message: 'Event updated successfully!', severity: 'success' });
        setEditDialogOpen(false);
        setEditEvent(null);
        loadEvents();
      } else {
        const error = await response.text();
        setSnackbar({ open: true, message: error || 'Failed to update event', severity: 'error' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to update event', severity: 'error' });
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    try {
      // Note: You may need to add a DELETE endpoint in the API
      const response = await fetch(`${API_URL}/admin/event/${eventToDelete._id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setSnackbar({ open: true, message: 'Event deleted successfully!', severity: 'success' });
        setDeleteDialogOpen(false);
        setEventToDelete(null);
        if (selectedEvent?._id === eventToDelete._id) {
          setSelectedEvent(null);
        }
        loadEvents();
      } else {
        const error = await response.text();
        setSnackbar({ open: true, message: error || 'Failed to delete event', severity: 'error' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to delete event', severity: 'error' });
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { id: 'events', label: 'Events', icon: <EventIcon /> },
    { id: 'users', label: 'Users', icon: <PeopleIcon /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChartIcon /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
  ];

  const renderDashboard = () => (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 4, color: '#1e293b' }}>
        Dashboard
      </Typography>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Users
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#10b981' }}>
                    {totalUsers}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: alpha('#10b981', 0.1), width: 56, height: 56 }}>
                  <PeopleIcon sx={{ color: '#10b981', fontSize: 28 }} />
                </Avatar>
              </Box>
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10b981' }} />
                <Typography variant="caption" color="text.secondary">
                  {queueData.active.length} active, {queueData.waiting.length} waiting
                </Typography>
              </Box>
            </CardContent>
          </KPICard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <KPICard>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Events
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#ef4444' }}>
                    {totalEvents}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: alpha('#ef4444', 0.1), width: 56, height: 56 }}>
                  <EventIcon sx={{ color: '#ef4444', fontSize: 28 }} />
                </Avatar>
              </Box>
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ef4444' }} />
                <Typography variant="caption" color="text.secondary">
                  {activeQueues} active queues
                </Typography>
              </Box>
            </CardContent>
          </KPICard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <KPICard>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Active Queues
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#f59e0b' }}>
                    {activeQueues}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: alpha('#f59e0b', 0.1), width: 56, height: 56 }}>
                  <TrendingUpIcon sx={{ color: '#f59e0b', fontSize: 28 }} />
                </Avatar>
              </Box>
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#f59e0b' }} />
                <Typography variant="caption" color="text.secondary">
                  Currently running
                </Typography>
              </Box>
            </CardContent>
          </KPICard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <KPICard>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Queue Capacity
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#6366f1' }}>
                    {selectedEvent?.queueLimit || 0}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: alpha('#6366f1', 0.1), width: 56, height: 56 }}>
                  <TimerIcon sx={{ color: '#6366f1', fontSize: 28 }} />
                </Avatar>
              </Box>
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#6366f1' }} />
                <Typography variant="caption" color="text.secondary">
                  Per batch
                </Typography>
              </Box>
            </CardContent>
          </KPICard>
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                Queue Activity Over Time
              </Typography>
              {history.length > 0 ? (
                <LineChart
                  width={700}
                  height={300}
                  series={[
                    { 
                      data: history.map(h => h.active), 
                      label: 'Active Users', 
                      color: '#10b981',
                      curve: 'monotoneX',
                    },
                    { 
                      data: history.map(h => h.waiting), 
                      label: 'Waiting Users', 
                      color: '#f59e0b',
                      curve: 'monotoneX',
                    },
                  ]}
                  xAxis={[{ 
                    scaleType: 'point', 
                    data: history.map((_, i) => i.toString()),
                  }]}
                  grid={{ vertical: true, horizontal: true }}
                />
              ) : (
                <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="text.secondary">No data available</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                User Distribution
              </Typography>
              <PieChart
                height={300}
                series={[{
                  data: [
                    { id: 0, value: queueData.active.length, label: 'Active', color: '#10b981' },
                    { id: 1, value: queueData.waiting.length, label: 'Waiting', color: '#f59e0b' },
                  ],
                  innerRadius: 40,
                  outerRadius: 100,
                }]}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Events Management Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Events Management
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
                size="small"
              >
                Create Event
              </Button>
              <IconButton onClick={loadEvents} size="small">
              <RefreshIcon />
            </IconButton>
            </Stack>
          </Box>
          {selectedEvent && (
            <Box sx={{ mb: 2, p: 2, bgcolor: alpha('#1e40af', 0.05), borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {selectedEvent.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedEvent.domain}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<StartIcon />}
                    onClick={startQueue}
                    disabled={isLoading || selectedEvent.isActive}
                    size="small"
                  >
                    Start
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<StopIcon />}
                    onClick={stopQueue}
                    disabled={isLoading || !selectedEvent.isActive}
                    size="small"
                  >
                    Stop
                  </Button>
                </Stack>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Events Table */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              All Events
            </Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha('#6366f1', 0.05) }}>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Domain</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Queue Limit</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Interval</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((event) => (
                  <TableRow 
                    key={event._id} 
                    hover
                    onClick={() => setSelectedEvent(event)}
                    sx={{ 
                      cursor: 'pointer',
                      bgcolor: selectedEvent?._id === event._id ? alpha('#1e40af', 0.05) : 'inherit'
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {event.name}
                      </Typography>
                    </TableCell>
                    <TableCell>{event.domain}</TableCell>
                    <TableCell>
                      <Chip
                        label={event.isActive ? 'Active' : 'Inactive'}
                        color={event.isActive ? 'success' : 'default'}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>{event.queueLimit}</TableCell>
                    <TableCell>{event.intervalSec}s</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Stack direction="row" spacing={0.5}>
                      <IconButton
                        size="small"
                        onClick={() => {
                            setEditEvent(event);
                            setEditDialogOpen(true);
                        }}
                      >
                          <EditIcon fontSize="small" />
                      </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEventToDelete(event);
                            setDeleteDialogOpen(true);
                          }}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );

  const renderEvents = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b' }}>
          Events Management
        </Typography>
        <Button variant="contained" startIcon={<EventIcon />}>
          Create Event
        </Button>
      </Box>

      {selectedEvent && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {selectedEvent.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedEvent.domain}
                </Typography>
              </Box>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<StartIcon />}
                  onClick={startQueue}
                  disabled={isLoading || selectedEvent.isActive}
                >
                  Start
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<StopIcon />}
                  onClick={stopQueue}
                  disabled={isLoading || !selectedEvent.isActive}
                >
                  Stop
                </Button>
              </Stack>
            </Box>
            {queueData.remaining > 0 && (
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Time Remaining</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {Math.floor(queueData.remaining / 60)}:{(queueData.remaining % 60).toString().padStart(2, '0')}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(queueData.remaining / (selectedEvent.intervalSec || 30)) * 100}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha('#6366f1', 0.05) }}>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Domain</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Queue Limit</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Interval</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((event) => (
                  <TableRow 
                    key={event._id} 
                    hover
                    onClick={() => setSelectedEvent(event)}
                    sx={{ cursor: 'pointer', bgcolor: selectedEvent?._id === event._id ? alpha('#6366f1', 0.05) : 'inherit' }}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {event.name}
                      </Typography>
                    </TableCell>
                    <TableCell>{event.domain}</TableCell>
                    <TableCell>
                      <Chip
                        label={event.isActive ? 'Active' : 'Inactive'}
                        color={event.isActive ? 'success' : 'default'}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>{event.queueLimit}</TableCell>
                    <TableCell>{event.intervalSec}s</TableCell>
                    <TableCell>
                      <IconButton size="small">
                        <SettingsIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );

  const renderUsers = () => (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 4, color: '#1e293b' }}>
        Queue Users
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <CheckCircleIcon sx={{ color: '#10b981', mr: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Active Users ({queueData.active.length})
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha('#10b981', 0.1) }}>
                      <TableCell sx={{ fontWeight: 600 }}>Position</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>User ID</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {queueData.active.map((userId, index) => (
                      <TableRow key={userId}>
                        <TableCell>#{index + 1}</TableCell>
                        <TableCell>{userId}</TableCell>
                        <TableCell>
                          <Chip label="Active" color="success" size="small" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <ScheduleIcon sx={{ color: '#f59e0b', mr: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Waiting Users ({queueData.waiting.length})
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha('#f59e0b', 0.1) }}>
                      <TableCell sx={{ fontWeight: 600 }}>Position</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>User ID</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {queueData.waiting.map((userId, index) => (
                      <TableRow key={userId}>
                        <TableCell>#{queueData.active.length + index + 1}</TableCell>
                        <TableCell>{userId}</TableCell>
                        <TableCell>
                          <Chip label="Waiting" color="warning" size="small" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  const renderAnalytics = () => (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 4, color: '#1e293b' }}>
        Analytics
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                Queue Performance
              </Typography>
              {history.length > 0 ? (
                <LineChart
                  width={900}
                  height={400}
                  series={[
                    { data: history.map(h => h.active), label: 'Active', color: '#10b981', curve: 'monotoneX' },
                    { data: history.map(h => h.waiting), label: 'Waiting', color: '#f59e0b', curve: 'monotoneX' },
                  ]}
                  xAxis={[{ scaleType: 'point', data: history.map((_, i) => i.toString()) }]}
                  grid={{ vertical: true, horizontal: true }}
                />
              ) : (
                <Box sx={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="text.secondary">No data available</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <SidebarDrawer variant="permanent" anchor="left">
        <Box sx={{ p: 3, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'white' }}>
            Queue Admin
          </Typography>
        </Box>
        <List sx={{ pt: 2 }}>
          {menuItems.map((item) => (
            <ListItem key={item.id} disablePadding>
              <ListItemButton
                selected={selectedView === item.id}
                onClick={() => setSelectedView(item.id)}
                sx={{
                  mx: 1,
                  mb: 0.5,
                  borderRadius: 2,
                  '&.Mui-selected': {
                    bgcolor: 'rgba(255, 255, 255, 0.15)',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.2)',
                    },
                  },
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
              >
                <ListItemIcon sx={{ color: 'white', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.label} 
                  primaryTypographyProps={{ 
                    fontWeight: selectedView === item.id ? 600 : 400,
                    color: 'white',
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </SidebarDrawer>

      <MainContent>
        {selectedView === 'dashboard' && renderDashboard()}
        {selectedView === 'events' && renderEvents()}
        {selectedView === 'users' && renderUsers()}
        {selectedView === 'analytics' && renderAnalytics()}
        {selectedView === 'settings' && (
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b' }}>
              Settings
            </Typography>
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography>Settings panel coming soon...</Typography>
              </CardContent>
            </Card>
          </Box>
        )}
      </MainContent>

      {/* Create Event Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Event</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Event Name"
              fullWidth
              value={newEvent.name}
              onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
            />
            <TextField
              label="Domain"
              fullWidth
              value={newEvent.domain}
              onChange={(e) => setNewEvent({ ...newEvent, domain: e.target.value })}
              placeholder="e.g., demo.com"
            />
            <TextField
              label="Queue Limit"
              type="number"
              fullWidth
              value={newEvent.queueLimit}
              onChange={(e) => setNewEvent({ ...newEvent, queueLimit: parseInt(e.target.value) || 2 })}
            />
            <TextField
              label="Interval (seconds)"
              type="number"
              fullWidth
              value={newEvent.intervalSec}
              onChange={(e) => setNewEvent({ ...newEvent, intervalSec: parseInt(e.target.value) || 30 })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateEvent} variant="contained" disabled={!newEvent.name || !newEvent.domain}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Event</DialogTitle>
        <DialogContent>
          {editEvent && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Event Name"
                fullWidth
                value={editEvent.name}
                disabled
                helperText="Event name cannot be changed"
              />
              <TextField
                label="Domain"
                fullWidth
                value={editEvent.domain}
                disabled
                helperText="Domain cannot be changed"
              />
              <TextField
                label="Queue Limit"
                type="number"
                fullWidth
                value={editEvent.queueLimit}
                onChange={(e) => setEditEvent({ ...editEvent, queueLimit: parseInt(e.target.value) || 2 })}
              />
              <TextField
                label="Interval (seconds)"
                type="number"
                fullWidth
                value={editEvent.intervalSec}
                onChange={(e) => setEditEvent({ ...editEvent, intervalSec: parseInt(e.target.value) || 30 })}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateEvent} variant="contained">
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Event Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Event</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the event "{eventToDelete?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteEvent} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default AdminApp;
