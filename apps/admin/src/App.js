import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { Box, Button, Card, CardContent, Drawer, Grid, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Chip, Avatar, alpha, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Stack, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Snackbar, Alert, Select, MenuItem, FormControl, InputLabel, FormHelperText, } from '@mui/material';
import { Dashboard as DashboardIcon, Event as EventIcon, People as PeopleIcon, Settings as SettingsIcon, BarChart as BarChartIcon, TrendingUp as TrendingUpIcon, PlayArrow as StartIcon, Stop as StopIcon, Refresh as RefreshIcon, CheckCircle as CheckCircleIcon, Schedule as ScheduleIcon, Timer as TimerIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, } from '@mui/icons-material';
import { LineChart, PieChart } from '@mui/x-charts';
import { styled } from '@mui/material/styles';
import * as sdk from 'queue-sdk';
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
function AdminApp() {
    const [selectedView, setSelectedView] = useState('dashboard');
    const [events, setEvents] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [queueData, setQueueData] = useState({
        active: [],
        waiting: [],
        remaining: 0,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [eventToDelete, setEventToDelete] = useState(null);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success',
    });
    const [newEvent, setNewEvent] = useState({
        name: '',
        domain: '',
        queueLimit: 2,
        intervalSec: 30,
    });
    const [editEvent, setEditEvent] = useState(null);
    const [domains, setDomains] = useState([]);
    const [showCreateDomainDialog, setShowCreateDomainDialog] = useState(false);
    const [newDomainName, setNewDomainName] = useState('');
    const [domainSelectMode, setDomainSelectMode] = useState('select');
    const loadDomains = async () => {
        try {
            const domainsList = await sdk.admin.getDomains();
            setDomains(domainsList);
        }
        catch (error) {
            console.error('Failed to load domains:', error);
            setSnackbar({
                open: true,
                message: 'Failed to load domains',
                severity: 'error',
            });
        }
    };
    const handleCreateDomain = async () => {
        if (!newDomainName.trim()) {
            setSnackbar({
                open: true,
                message: 'Domain name is required',
                severity: 'error',
            });
            return;
        }
        try {
            const result = await sdk.admin.createDomain(newDomainName.trim());
            setSnackbar({
                open: true,
                message: `Domain "${result.name}" created successfully!`,
                severity: 'success',
            });
            await loadDomains();
            setNewEvent({ ...newEvent, domain: result.name });
            setNewDomainName('');
            setShowCreateDomainDialog(false);
            setDomainSelectMode('select');
        }
        catch (error) {
            console.error('Error creating domain:', error);
            setSnackbar({
                open: true,
                message: error.message || 'Failed to create domain',
                severity: 'error',
            });
        }
    };
    const loadEvents = async () => {
        try {
            const data = await sdk.getEvents();
            setEvents(data);
            if (data.length > 0) {
                // If we have a selected event, check if it still exists
                if (selectedEvent) {
                    const stillExists = data.find((e) => e._id === selectedEvent._id);
                    if (!stillExists) {
                        // Selected event was deleted, select the first one
                        setSelectedEvent(data[0]);
                    }
                    else {
                        // Update selected event with latest data
                        setSelectedEvent(stillExists);
                    }
                }
                else {
                    // No selected event, select the first one
                    setSelectedEvent(data[0]);
                }
            }
            else {
                setSelectedEvent(null);
            }
        }
        catch (error) {
            console.error('Error loading events:', error);
            setSnackbar({
                open: true,
                message: error.message || 'Failed to load events',
                severity: 'error',
            });
        }
    };
    const loadQueueData = useCallback(async (eventId) => {
        if (!eventId)
            return;
        try {
            const data = await sdk.getQueueUsers(eventId);
            setQueueData({
                active: data.active || [],
                waiting: data.waiting || [],
                remaining: data.remaining || 0,
            });
            const now = Date.now();
            setHistory((prev) => {
                const next = [
                    ...prev,
                    {
                        t: now,
                        active: (data.active || []).length,
                        waiting: (data.waiting || []).length,
                    },
                ];
                return next.slice(-30);
            });
        }
        catch (error) {
            console.error('Failed to load queue data:', error);
            // Don't show snackbar for queue data errors as they happen frequently during polling
        }
    }, []);
    useEffect(() => {
        // SDK will auto-detect API URL from environment or use relative path
        loadEvents();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        if (selectedEvent) {
            loadQueueData(selectedEvent._id);
            const interval = setInterval(() => {
                loadQueueData(selectedEvent._id);
            }, 2000);
            return () => clearInterval(interval);
        }
        else {
            // Clear queue data when no event is selected
            setQueueData({
                active: [],
                waiting: [],
                remaining: 0,
            });
            setHistory([]);
        }
    }, [selectedEvent, loadQueueData]);
    const startQueue = async () => {
        if (!selectedEvent)
            return;
        setIsLoading(true);
        try {
            await sdk.startQueue(selectedEvent._id);
            setSnackbar({
                open: true,
                message: 'Queue started successfully!',
                severity: 'success',
            });
            loadEvents();
            loadQueueData(selectedEvent._id);
        }
        catch (error) {
            console.error('Error starting queue:', error);
            setSnackbar({
                open: true,
                message: error.message || 'Failed to start queue',
                severity: 'error',
            });
        }
        finally {
            setIsLoading(false);
        }
    };
    const stopQueue = async () => {
        if (!selectedEvent)
            return;
        setIsLoading(true);
        try {
            await sdk.stopQueue(selectedEvent._id);
            setSnackbar({
                open: true,
                message: 'Queue stopped successfully!',
                severity: 'success',
            });
            loadEvents();
            loadQueueData(selectedEvent._id);
        }
        catch (error) {
            console.error('Error stopping queue:', error);
            setSnackbar({
                open: true,
                message: error.message || 'Failed to stop queue',
                severity: 'error',
            });
        }
        finally {
            setIsLoading(false);
        }
    };
    const totalUsers = queueData.active.length + queueData.waiting.length;
    const activeQueues = events.filter((e) => e.isActive).length;
    const totalEvents = events.length;
    const handleCreateEvent = async () => {
        try {
            await sdk.createEvent({
                domain: newEvent.domain,
                name: newEvent.name,
                queueLimit: newEvent.queueLimit,
                intervalSec: newEvent.intervalSec,
            });
            setSnackbar({
                open: true,
                message: 'Event created successfully!',
                severity: 'success',
            });
            setCreateDialogOpen(false);
            setNewEvent({ name: '', domain: '', queueLimit: 2, intervalSec: 30 });
            loadEvents();
        }
        catch (error) {
            setSnackbar({
                open: true,
                message: error.message || 'Failed to create event',
                severity: 'error',
            });
        }
    };
    const handleUpdateEvent = async () => {
        if (!editEvent)
            return;
        try {
            await sdk.updateEvent(editEvent._id, {
                queueLimit: editEvent.queueLimit,
                intervalSec: editEvent.intervalSec,
            });
            setSnackbar({
                open: true,
                message: 'Event updated successfully!',
                severity: 'success',
            });
            setEditDialogOpen(false);
            setEditEvent(null);
            loadEvents();
        }
        catch (error) {
            setSnackbar({
                open: true,
                message: error.message || 'Failed to update event',
                severity: 'error',
            });
        }
    };
    const handleDeleteEvent = async () => {
        if (!eventToDelete)
            return;
        try {
            await sdk.deleteEvent(eventToDelete._id);
            setSnackbar({
                open: true,
                message: 'Event deleted successfully!',
                severity: 'success',
            });
            setDeleteDialogOpen(false);
            setEventToDelete(null);
            if (selectedEvent?._id === eventToDelete._id) {
                setSelectedEvent(null);
            }
            loadEvents();
        }
        catch (error) {
            setSnackbar({
                open: true,
                message: error.message || 'Failed to delete event',
                severity: 'error',
            });
        }
    };
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: _jsx(DashboardIcon, {}) },
        { id: 'events', label: 'Events', icon: _jsx(EventIcon, {}) },
        { id: 'users', label: 'Users', icon: _jsx(PeopleIcon, {}) },
        { id: 'analytics', label: 'Analytics', icon: _jsx(BarChartIcon, {}) },
        { id: 'settings', label: 'Settings', icon: _jsx(SettingsIcon, {}) },
    ];
    const renderDashboard = () => (_jsxs(Box, { children: [_jsx(Typography, { variant: "h4", sx: { fontWeight: 700, mb: 4, color: '#1e293b' }, children: "Dashboard" }), _jsxs(Grid, { container: true, spacing: 3, sx: { mb: 4 }, children: [_jsx(Grid, { item: true, xs: 12, sm: 6, md: 3, children: _jsx(KPICard, { children: _jsxs(CardContent, { children: [_jsxs(Box, { sx: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                        }, children: [_jsxs(Box, { children: [_jsx(Typography, { variant: "body2", color: "text.secondary", gutterBottom: true, children: "Total Users" }), _jsx(Typography, { variant: "h4", sx: { fontWeight: 700, color: '#10b981' }, children: totalUsers })] }), _jsx(Avatar, { sx: { bgcolor: alpha('#10b981', 0.1), width: 56, height: 56 }, children: _jsx(PeopleIcon, { sx: { color: '#10b981', fontSize: 28 } }) })] }), _jsxs(Box, { sx: { mt: 2, display: 'flex', alignItems: 'center', gap: 1 }, children: [_jsx(Box, { sx: {
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: '50%',
                                                    bgcolor: '#10b981',
                                                } }), _jsxs(Typography, { variant: "caption", color: "text.secondary", children: [queueData.active.length, " active, ", queueData.waiting.length, ' ', "waiting"] })] })] }) }) }), _jsx(Grid, { item: true, xs: 12, sm: 6, md: 3, children: _jsx(KPICard, { children: _jsxs(CardContent, { children: [_jsxs(Box, { sx: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                        }, children: [_jsxs(Box, { children: [_jsx(Typography, { variant: "body2", color: "text.secondary", gutterBottom: true, children: "Total Events" }), _jsx(Typography, { variant: "h4", sx: { fontWeight: 700, color: '#ef4444' }, children: totalEvents })] }), _jsx(Avatar, { sx: { bgcolor: alpha('#ef4444', 0.1), width: 56, height: 56 }, children: _jsx(EventIcon, { sx: { color: '#ef4444', fontSize: 28 } }) })] }), _jsxs(Box, { sx: { mt: 2, display: 'flex', alignItems: 'center', gap: 1 }, children: [_jsx(Box, { sx: {
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: '50%',
                                                    bgcolor: '#ef4444',
                                                } }), _jsxs(Typography, { variant: "caption", color: "text.secondary", children: [activeQueues, " active queues"] })] })] }) }) }), _jsx(Grid, { item: true, xs: 12, sm: 6, md: 3, children: _jsx(KPICard, { children: _jsxs(CardContent, { children: [_jsxs(Box, { sx: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                        }, children: [_jsxs(Box, { children: [_jsx(Typography, { variant: "body2", color: "text.secondary", gutterBottom: true, children: "Active Queues" }), _jsx(Typography, { variant: "h4", sx: { fontWeight: 700, color: '#f59e0b' }, children: activeQueues })] }), _jsx(Avatar, { sx: { bgcolor: alpha('#f59e0b', 0.1), width: 56, height: 56 }, children: _jsx(TrendingUpIcon, { sx: { color: '#f59e0b', fontSize: 28 } }) })] }), _jsxs(Box, { sx: { mt: 2, display: 'flex', alignItems: 'center', gap: 1 }, children: [_jsx(Box, { sx: {
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: '50%',
                                                    bgcolor: '#f59e0b',
                                                } }), _jsx(Typography, { variant: "caption", color: "text.secondary", children: "Currently running" })] })] }) }) }), _jsx(Grid, { item: true, xs: 12, sm: 6, md: 3, children: _jsx(KPICard, { children: _jsxs(CardContent, { children: [_jsxs(Box, { sx: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                        }, children: [_jsxs(Box, { children: [_jsx(Typography, { variant: "body2", color: "text.secondary", gutterBottom: true, children: "Queue Capacity" }), _jsx(Typography, { variant: "h4", sx: { fontWeight: 700, color: '#6366f1' }, children: selectedEvent?.queueLimit || 0 })] }), _jsx(Avatar, { sx: { bgcolor: alpha('#6366f1', 0.1), width: 56, height: 56 }, children: _jsx(TimerIcon, { sx: { color: '#6366f1', fontSize: 28 } }) })] }), _jsxs(Box, { sx: { mt: 2, display: 'flex', alignItems: 'center', gap: 1 }, children: [_jsx(Box, { sx: {
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: '50%',
                                                    bgcolor: '#6366f1',
                                                } }), _jsx(Typography, { variant: "caption", color: "text.secondary", children: "Per batch" })] })] }) }) })] }), _jsxs(Grid, { container: true, spacing: 3, sx: { mb: 4 }, children: [_jsx(Grid, { item: true, xs: 12, md: 8, children: _jsx(Card, { children: _jsxs(CardContent, { children: [_jsx(Typography, { variant: "h6", sx: { fontWeight: 600, mb: 3 }, children: "Queue Activity Over Time" }), history.length > 0 ? (_jsx(LineChart, { width: 700, height: 300, series: [
                                            {
                                                data: history.map((h) => h.active),
                                                label: 'Active Users',
                                                color: '#10b981',
                                                curve: 'monotoneX',
                                            },
                                            {
                                                data: history.map((h) => h.waiting),
                                                label: 'Waiting Users',
                                                color: '#f59e0b',
                                                curve: 'monotoneX',
                                            },
                                        ], xAxis: [
                                            {
                                                scaleType: 'point',
                                                data: history.map((_, i) => i.toString()),
                                            },
                                        ], grid: { vertical: true, horizontal: true } })) : (_jsx(Box, { sx: {
                                            height: 300,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }, children: _jsx(Typography, { color: "text.secondary", children: "No data available" }) }))] }) }) }), _jsx(Grid, { item: true, xs: 12, md: 4, children: _jsx(Card, { children: _jsxs(CardContent, { children: [_jsx(Typography, { variant: "h6", sx: { fontWeight: 600, mb: 3 }, children: "User Distribution" }), _jsx(PieChart, { height: 300, series: [
                                            {
                                                data: [
                                                    {
                                                        id: 0,
                                                        value: queueData.active.length,
                                                        label: 'Active',
                                                        color: '#10b981',
                                                    },
                                                    {
                                                        id: 1,
                                                        value: queueData.waiting.length,
                                                        label: 'Waiting',
                                                        color: '#f59e0b',
                                                    },
                                                ],
                                                innerRadius: 40,
                                                outerRadius: 100,
                                            },
                                        ] })] }) }) })] }), _jsx(Card, { sx: { mb: 3 }, children: _jsxs(CardContent, { children: [_jsxs(Box, { sx: {
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                mb: 2,
                            }, children: [_jsx(Typography, { variant: "h6", sx: { fontWeight: 600 }, children: "Events Management" }), _jsxs(Stack, { direction: "row", spacing: 1, children: [_jsx(Button, { variant: "contained", startIcon: _jsx(AddIcon, {}), onClick: () => setCreateDialogOpen(true), size: "small", children: "Create Event" }), _jsx(IconButton, { onClick: loadEvents, size: "small", children: _jsx(RefreshIcon, {}) })] })] }), selectedEvent && (_jsx(Box, { sx: {
                                mb: 2,
                                p: 2,
                                bgcolor: alpha('#1e40af', 0.05),
                                borderRadius: 2,
                            }, children: _jsxs(Box, { sx: {
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }, children: [_jsxs(Box, { children: [_jsx(Typography, { variant: "subtitle1", sx: { fontWeight: 600 }, children: selectedEvent.name }), _jsx(Typography, { variant: "body2", color: "text.secondary", children: selectedEvent.domain })] }), _jsxs(Stack, { direction: "row", spacing: 1, children: [_jsx(Button, { variant: "contained", color: "success", startIcon: _jsx(StartIcon, {}), onClick: startQueue, disabled: isLoading || selectedEvent.isActive, size: "small", children: "Start" }), _jsx(Button, { variant: "contained", color: "error", startIcon: _jsx(StopIcon, {}), onClick: stopQueue, disabled: isLoading || !selectedEvent.isActive, size: "small", children: "Stop" })] })] }) }))] }) }), _jsx(Card, { children: _jsxs(CardContent, { children: [_jsx(Box, { sx: {
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                mb: 3,
                            }, children: _jsx(Typography, { variant: "h6", sx: { fontWeight: 600 }, children: "All Events" }) }), _jsx(TableContainer, { children: _jsxs(Table, { children: [_jsx(TableHead, { children: _jsxs(TableRow, { sx: { bgcolor: alpha('#6366f1', 0.05) }, children: [_jsx(TableCell, { sx: { fontWeight: 600 }, children: "Name" }), _jsx(TableCell, { sx: { fontWeight: 600 }, children: "Domain" }), _jsx(TableCell, { sx: { fontWeight: 600 }, children: "Status" }), _jsx(TableCell, { sx: { fontWeight: 600 }, children: "Queue Limit" }), _jsx(TableCell, { sx: { fontWeight: 600 }, children: "Interval" }), _jsx(TableCell, { sx: { fontWeight: 600 }, children: "Actions" })] }) }), _jsxs(TableBody, { children: [events.map((event) => (_jsxs(TableRow, { hover: true, onClick: () => setSelectedEvent(event), sx: {
                                                    cursor: 'pointer',
                                                    bgcolor: selectedEvent?._id === event._id
                                                        ? alpha('#1e40af', 0.05)
                                                        : 'inherit',
                                                }, children: [_jsx(TableCell, { children: _jsx(Typography, { variant: "body2", sx: { fontWeight: 600 }, children: event.name }) }), _jsx(TableCell, { children: event.domain }), _jsx(TableCell, { children: _jsx(Chip, { label: event.isActive ? 'Active' : 'Inactive', color: event.isActive ? 'success' : 'default', size: "small", sx: { fontWeight: 600 } }) }), _jsx(TableCell, { children: event.queueLimit }), _jsxs(TableCell, { children: [event.intervalSec, "s"] }), _jsx(TableCell, { onClick: (e) => e.stopPropagation(), children: _jsxs(Stack, { direction: "row", spacing: 0.5, children: [_jsx(IconButton, { size: "small", onClick: () => {
                                                                        setEditEvent(event);
                                                                        setEditDialogOpen(true);
                                                                    }, children: _jsx(EditIcon, { fontSize: "small" }) }), _jsx(IconButton, { size: "small", onClick: () => {
                                                                        setEventToDelete(event);
                                                                        setDeleteDialogOpen(true);
                                                                    }, color: "error", children: _jsx(DeleteIcon, { fontSize: "small" }) })] }) })] }, event._id))), events.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 6, align: "center", sx: { py: 4 }, children: _jsx(Typography, { color: "text.secondary", children: "No events found. Create your first event to get started." }) }) }))] })] }) })] }) })] }));
    const renderEvents = () => (_jsxs(Box, { children: [_jsxs(Box, { sx: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 4,
                }, children: [_jsx(Typography, { variant: "h4", sx: { fontWeight: 700, color: '#1e293b' }, children: "Events Management" }), _jsxs(Stack, { direction: "row", spacing: 1, children: [_jsx(Button, { variant: "contained", startIcon: _jsx(AddIcon, {}), onClick: () => setCreateDialogOpen(true), children: "Create Event" }), _jsx(IconButton, { onClick: loadEvents, children: _jsx(RefreshIcon, {}) })] })] }), selectedEvent && (_jsx(Card, { sx: { mb: 3 }, children: _jsxs(CardContent, { children: [_jsxs(Box, { sx: {
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                mb: 2,
                            }, children: [_jsxs(Box, { children: [_jsx(Typography, { variant: "h6", sx: { fontWeight: 600 }, children: selectedEvent.name }), _jsx(Typography, { variant: "body2", color: "text.secondary", children: selectedEvent.domain })] }), _jsxs(Stack, { direction: "row", spacing: 2, children: [_jsx(Button, { variant: "contained", color: "success", startIcon: _jsx(StartIcon, {}), onClick: startQueue, disabled: isLoading || selectedEvent.isActive, children: "Start" }), _jsx(Button, { variant: "contained", color: "error", startIcon: _jsx(StopIcon, {}), onClick: stopQueue, disabled: isLoading || !selectedEvent.isActive, children: "Stop" })] })] }), queueData.remaining > 0 && (_jsxs(Box, { sx: { mt: 2 }, children: [_jsxs(Box, { sx: {
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        mb: 1,
                                    }, children: [_jsx(Typography, { variant: "body2", children: "Time Remaining" }), _jsxs(Typography, { variant: "body2", sx: { fontWeight: 600 }, children: [Math.floor(queueData.remaining / 60), ":", (queueData.remaining % 60).toString().padStart(2, '0')] })] }), _jsx(LinearProgress, { variant: "determinate", value: (queueData.remaining / (selectedEvent.intervalSec || 30)) *
                                        100, sx: { height: 8, borderRadius: 4 } })] }))] }) })), _jsx(Card, { children: _jsx(CardContent, { children: _jsx(TableContainer, { children: _jsxs(Table, { children: [_jsx(TableHead, { children: _jsxs(TableRow, { sx: { bgcolor: alpha('#6366f1', 0.05) }, children: [_jsx(TableCell, { sx: { fontWeight: 600 }, children: "Name" }), _jsx(TableCell, { sx: { fontWeight: 600 }, children: "Domain" }), _jsx(TableCell, { sx: { fontWeight: 600 }, children: "Status" }), _jsx(TableCell, { sx: { fontWeight: 600 }, children: "Queue Limit" }), _jsx(TableCell, { sx: { fontWeight: 600 }, children: "Interval" }), _jsx(TableCell, { sx: { fontWeight: 600 }, children: "Actions" })] }) }), _jsxs(TableBody, { children: [events.map((event) => (_jsxs(TableRow, { hover: true, onClick: () => setSelectedEvent(event), sx: {
                                                cursor: 'pointer',
                                                bgcolor: selectedEvent?._id === event._id
                                                    ? alpha('#6366f1', 0.05)
                                                    : 'inherit',
                                            }, children: [_jsx(TableCell, { children: _jsx(Typography, { variant: "body2", sx: { fontWeight: 600 }, children: event.name }) }), _jsx(TableCell, { children: event.domain }), _jsx(TableCell, { children: _jsx(Chip, { label: event.isActive ? 'Active' : 'Inactive', color: event.isActive ? 'success' : 'default', size: "small", sx: { fontWeight: 600 } }) }), _jsx(TableCell, { children: event.queueLimit }), _jsxs(TableCell, { children: [event.intervalSec, "s"] }), _jsx(TableCell, { onClick: (e) => e.stopPropagation(), children: _jsxs(Stack, { direction: "row", spacing: 0.5, children: [_jsx(IconButton, { size: "small", onClick: () => {
                                                                    setEditEvent(event);
                                                                    setEditDialogOpen(true);
                                                                }, children: _jsx(EditIcon, { fontSize: "small" }) }), _jsx(IconButton, { size: "small", onClick: () => {
                                                                    setEventToDelete(event);
                                                                    setDeleteDialogOpen(true);
                                                                }, color: "error", children: _jsx(DeleteIcon, { fontSize: "small" }) })] }) })] }, event._id))), events.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 6, align: "center", sx: { py: 4 }, children: _jsx(Typography, { color: "text.secondary", children: "No events found. Create your first event to get started." }) }) }))] })] }) }) }) })] }));
    const renderUsers = () => (_jsxs(Box, { children: [_jsx(Typography, { variant: "h4", sx: { fontWeight: 700, mb: 4, color: '#1e293b' }, children: "Queue Users" }), !selectedEvent ? (_jsx(Card, { children: _jsx(CardContent, { children: _jsxs(Box, { sx: { textAlign: 'center', py: 4 }, children: [_jsx(Typography, { variant: "h6", color: "text.secondary", gutterBottom: true, children: "No Event Selected" }), _jsx(Typography, { variant: "body2", color: "text.secondary", children: "Please select an event from the Events page to view queue users." })] }) }) })) : (_jsxs(Grid, { container: true, spacing: 3, children: [_jsx(Grid, { item: true, xs: 12, md: 6, children: _jsx(Card, { children: _jsxs(CardContent, { children: [_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', mb: 3 }, children: [_jsx(CheckCircleIcon, { sx: { color: '#10b981', mr: 1 } }), _jsxs(Typography, { variant: "h6", sx: { fontWeight: 600 }, children: ["Active Users (", queueData.active.length, ")"] })] }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { sx: { bgcolor: alpha('#10b981', 0.1) }, children: [_jsx(TableCell, { sx: { fontWeight: 600 }, children: "Position" }), _jsx(TableCell, { sx: { fontWeight: 600 }, children: "User ID" }), _jsx(TableCell, { sx: { fontWeight: 600 }, children: "Status" })] }) }), _jsx(TableBody, { children: queueData.active.length === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 3, align: "center", sx: { py: 3 }, children: _jsx(Typography, { variant: "body2", color: "text.secondary", children: "No active users" }) }) })) : (queueData.active.map((userId, index) => (_jsxs(TableRow, { children: [_jsxs(TableCell, { children: ["#", index + 1] }), _jsx(TableCell, { children: userId }), _jsx(TableCell, { children: _jsx(Chip, { label: "Active", color: "success", size: "small" }) })] }, userId)))) })] }) })] }) }) }), _jsx(Grid, { item: true, xs: 12, md: 6, children: _jsx(Card, { children: _jsxs(CardContent, { children: [_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', mb: 3 }, children: [_jsx(ScheduleIcon, { sx: { color: '#f59e0b', mr: 1 } }), _jsxs(Typography, { variant: "h6", sx: { fontWeight: 600 }, children: ["Waiting Users (", queueData.waiting.length, ")"] })] }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { sx: { bgcolor: alpha('#f59e0b', 0.1) }, children: [_jsx(TableCell, { sx: { fontWeight: 600 }, children: "Position" }), _jsx(TableCell, { sx: { fontWeight: 600 }, children: "User ID" }), _jsx(TableCell, { sx: { fontWeight: 600 }, children: "Status" })] }) }), _jsx(TableBody, { children: queueData.waiting.length === 0 ? (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 3, align: "center", sx: { py: 3 }, children: _jsx(Typography, { variant: "body2", color: "text.secondary", children: "No waiting users" }) }) })) : (queueData.waiting.map((userId, index) => (_jsxs(TableRow, { children: [_jsxs(TableCell, { children: ["#", queueData.active.length + index + 1] }), _jsx(TableCell, { children: userId }), _jsx(TableCell, { children: _jsx(Chip, { label: "Waiting", color: "warning", size: "small" }) })] }, userId)))) })] }) })] }) }) })] }))] }));
    const renderAnalytics = () => (_jsxs(Box, { children: [_jsx(Typography, { variant: "h4", sx: { fontWeight: 700, mb: 4, color: '#1e293b' }, children: "Analytics" }), _jsx(Grid, { container: true, spacing: 3, children: _jsx(Grid, { item: true, xs: 12, children: _jsx(Card, { children: _jsxs(CardContent, { children: [_jsx(Typography, { variant: "h6", sx: { fontWeight: 600, mb: 3 }, children: "Queue Performance" }), history.length > 0 ? (_jsx(LineChart, { width: 900, height: 400, series: [
                                        {
                                            data: history.map((h) => h.active),
                                            label: 'Active',
                                            color: '#10b981',
                                            curve: 'monotoneX',
                                        },
                                        {
                                            data: history.map((h) => h.waiting),
                                            label: 'Waiting',
                                            color: '#f59e0b',
                                            curve: 'monotoneX',
                                        },
                                    ], xAxis: [
                                        {
                                            scaleType: 'point',
                                            data: history.map((_, i) => i.toString()),
                                        },
                                    ], grid: { vertical: true, horizontal: true } })) : (_jsx(Box, { sx: {
                                        height: 400,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }, children: _jsx(Typography, { color: "text.secondary", children: "No data available" }) }))] }) }) }) })] }));
    return (_jsxs(Box, { sx: { display: 'flex' }, children: [_jsxs(SidebarDrawer, { variant: "permanent", anchor: "left", children: [_jsx(Box, { sx: { p: 3, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }, children: _jsx(Typography, { variant: "h5", sx: { fontWeight: 700, color: 'white' }, children: "Queue Admin" }) }), _jsx(List, { sx: { pt: 2 }, children: menuItems.map((item) => (_jsx(ListItem, { disablePadding: true, children: _jsxs(ListItemButton, { selected: selectedView === item.id, onClick: () => setSelectedView(item.id), sx: {
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
                                }, children: [_jsx(ListItemIcon, { sx: { color: 'white', minWidth: 40 }, children: item.icon }), _jsx(ListItemText, { primary: item.label, primaryTypographyProps: {
                                            fontWeight: selectedView === item.id ? 600 : 400,
                                            color: 'white',
                                        } })] }) }, item.id))) })] }), _jsxs(MainContent, { children: [selectedView === 'dashboard' && renderDashboard(), selectedView === 'events' && renderEvents(), selectedView === 'users' && renderUsers(), selectedView === 'analytics' && renderAnalytics(), selectedView === 'settings' && (_jsxs(Box, { children: [_jsx(Typography, { variant: "h4", sx: { fontWeight: 700, color: '#1e293b' }, children: "Settings" }), _jsx(Card, { sx: { mt: 3 }, children: _jsx(CardContent, { children: _jsx(Typography, { children: "Settings panel coming soon..." }) }) })] }))] }), _jsxs(Dialog, { open: createDialogOpen, onClose: () => setCreateDialogOpen(false), maxWidth: "sm", fullWidth: true, children: [_jsx(DialogTitle, { children: "Create New Event" }), _jsx(DialogContent, { children: _jsxs(Stack, { spacing: 2, sx: { mt: 1 }, children: [_jsx(TextField, { label: "Event Name", fullWidth: true, value: newEvent.name, onChange: (e) => setNewEvent({ ...newEvent, name: e.target.value }) }), _jsxs(FormControl, { fullWidth: true, children: [_jsx(InputLabel, { children: "Domain" }), _jsxs(Select, { value: domainSelectMode === 'create' ? 'create-new' : newEvent.domain, label: "Domain", onChange: (e) => {
                                                if (e.target.value === 'create-new') {
                                                    setDomainSelectMode('create');
                                                    setShowCreateDomainDialog(true);
                                                }
                                                else {
                                                    setDomainSelectMode('select');
                                                    setNewEvent({ ...newEvent, domain: e.target.value });
                                                }
                                            }, onOpen: () => {
                                                loadDomains();
                                            }, children: [domains.map((domain) => (_jsx(MenuItem, { value: domain.name, children: domain.name }, domain._id))), _jsx(MenuItem, { value: "create-new", children: _jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1 }, children: [_jsx(AddIcon, { fontSize: "small" }), "Create New Domain"] }) })] }), domainSelectMode === 'create' && (_jsx(FormHelperText, { children: "Click \"Create New Domain\" to add a new domain" }))] }), _jsx(TextField, { label: "Queue Limit", type: "number", fullWidth: true, value: newEvent.queueLimit, onChange: (e) => setNewEvent({
                                        ...newEvent,
                                        queueLimit: parseInt(e.target.value) || 2,
                                    }) }), _jsx(TextField, { label: "Interval (seconds)", type: "number", fullWidth: true, value: newEvent.intervalSec, onChange: (e) => setNewEvent({
                                        ...newEvent,
                                        intervalSec: parseInt(e.target.value) || 30,
                                    }) })] }) }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: () => setCreateDialogOpen(false), children: "Cancel" }), _jsx(Button, { onClick: handleCreateEvent, variant: "contained", disabled: !newEvent.name || !newEvent.domain, children: "Create" })] })] }), _jsxs(Dialog, { open: showCreateDomainDialog, onClose: () => {
                    setShowCreateDomainDialog(false);
                    setNewDomainName('');
                    setDomainSelectMode('select');
                }, maxWidth: "sm", fullWidth: true, children: [_jsx(DialogTitle, { children: "Create New Domain" }), _jsx(DialogContent, { children: _jsx(Stack, { spacing: 2, sx: { mt: 1 }, children: _jsx(TextField, { label: "Domain Name", fullWidth: true, value: newDomainName, onChange: (e) => setNewDomainName(e.target.value), placeholder: "e.g., example.com", autoFocus: true, onKeyPress: (e) => {
                                    if (e.key === 'Enter') {
                                        handleCreateDomain();
                                    }
                                } }) }) }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: () => {
                                    setShowCreateDomainDialog(false);
                                    setNewDomainName('');
                                    setDomainSelectMode('select');
                                }, children: "Cancel" }), _jsx(Button, { onClick: handleCreateDomain, variant: "contained", disabled: !newDomainName.trim(), children: "Create Domain" })] })] }), _jsxs(Dialog, { open: editDialogOpen, onClose: () => setEditDialogOpen(false), maxWidth: "sm", fullWidth: true, children: [_jsx(DialogTitle, { children: "Edit Event" }), _jsx(DialogContent, { children: editEvent && (_jsxs(Stack, { spacing: 2, sx: { mt: 1 }, children: [_jsx(TextField, { label: "Event Name", fullWidth: true, value: editEvent.name, disabled: true, helperText: "Event name cannot be changed" }), _jsx(TextField, { label: "Domain", fullWidth: true, value: editEvent.domain, disabled: true, helperText: "Domain cannot be changed" }), _jsx(TextField, { label: "Queue Limit", type: "number", fullWidth: true, value: editEvent.queueLimit, onChange: (e) => setEditEvent({
                                        ...editEvent,
                                        queueLimit: parseInt(e.target.value) || 2,
                                    }) }), _jsx(TextField, { label: "Interval (seconds)", type: "number", fullWidth: true, value: editEvent.intervalSec, onChange: (e) => setEditEvent({
                                        ...editEvent,
                                        intervalSec: parseInt(e.target.value) || 30,
                                    }) })] })) }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: () => setEditDialogOpen(false), children: "Cancel" }), _jsx(Button, { onClick: handleUpdateEvent, variant: "contained", children: "Update" })] })] }), _jsxs(Dialog, { open: deleteDialogOpen, onClose: () => setDeleteDialogOpen(false), children: [_jsx(DialogTitle, { children: "Delete Event" }), _jsx(DialogContent, { children: _jsxs(Typography, { children: ["Are you sure you want to delete the event \"", eventToDelete?.name, "\"? This action cannot be undone."] }) }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: () => setDeleteDialogOpen(false), children: "Cancel" }), _jsx(Button, { onClick: handleDeleteEvent, variant: "contained", color: "error", children: "Delete" })] })] }), _jsx(Snackbar, { open: snackbar.open, autoHideDuration: 6000, onClose: () => setSnackbar({ ...snackbar, open: false }), anchorOrigin: { vertical: 'bottom', horizontal: 'center' }, children: _jsx(Alert, { onClose: () => setSnackbar({ ...snackbar, open: false }), severity: snackbar.severity, sx: { width: '100%' }, children: snackbar.message }) })] }));
}
export default AdminApp;
