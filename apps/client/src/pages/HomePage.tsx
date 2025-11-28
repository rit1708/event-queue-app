import { useEffect, useState } from 'react';
import { EventsList, type Event } from 'queue-sdk';
import * as sdk from 'queue-sdk';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Snackbar,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

interface HomePageProps {
  onEventSelect: (event: Event) => void;
}

export const HomePage = ({ onEventSelect }: HomePageProps) => {
  const [userId] = useState(() => 'user-' + Math.random().toString(36).slice(2, 10));
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [eventsListKey, setEventsListKey] = useState(0);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });
  const [newEvent, setNewEvent] = useState({
    name: '',
    domain: '',
    queueLimit: 2,
    intervalSec: 30,
  });
  const [domains, setDomains] = useState<{ _id: string; name: string }[]>([]);
  const [showCreateDomainDialog, setShowCreateDomainDialog] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [domainSelectMode, setDomainSelectMode] = useState<'select' | 'create'>('select');

  const loadDomains = async () => {
    try {
      const domainList = await sdk.admin.getDomains();
      setDomains(domainList);
    } catch (error) {
      setSnackbar({
        open: true,
        message: (error as Error).message || 'Failed to load domains',
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
      setNewEvent((prev) => ({ ...prev, domain: result.name }));
      setNewDomainName('');
      setShowCreateDomainDialog(false);
      setDomainSelectMode('select');
    } catch (error) {
      setSnackbar({
        open: true,
        message: (error as Error).message || 'Failed to create domain',
        severity: 'error',
      });
    }
  };

  useEffect(() => {
    loadDomains();
  }, []);

  const handleCreateEvent = async () => {
    if (!newEvent.name.trim() || !newEvent.domain.trim()) {
      setSnackbar({
        open: true,
        message: 'Event name and domain are required',
        severity: 'error',
      });
      return;
    }

    setCreating(true);
    try {
      await sdk.createEvent({
        name: newEvent.name.trim(),
        domain: newEvent.domain.trim(),
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
      setEventsListKey((prev) => prev + 1); // Refresh the events list
    } catch (error) {
      setSnackbar({
        open: true,
        message: (error as Error).message || 'Failed to create event',
        severity: 'error',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Box sx={{ maxWidth: '1200px', mx: 'auto', px: { xs: 2, md: 4 }, py: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create Event
          </Button>
        </Box>

        <EventsList
          key={eventsListKey}
          userId={userId}
          onEventSelect={onEventSelect}
          autoJoin={true}
        />
      </Box>

      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Event</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Event Name"
              fullWidth
              value={newEvent.name}
              onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Domain</InputLabel>
              <Select
                label="Domain"
                value={domainSelectMode === 'create' ? 'create-new' : newEvent.domain}
                onChange={(e) => {
                  if (e.target.value === 'create-new') {
                    setDomainSelectMode('create');
                    setShowCreateDomainDialog(true);
                  } else {
                    setDomainSelectMode('select');
                    setNewEvent({ ...newEvent, domain: e.target.value });
                  }
                }}
                onOpen={loadDomains}
              >
                {domains.map((domain) => (
                  <MenuItem key={domain._id} value={domain.name}>
                    {domain.name}
                  </MenuItem>
                ))}
                <MenuItem value="create-new">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AddIcon fontSize="small" />
                    Create New Domain
                  </Box>
                </MenuItem>
              </Select>
              {domainSelectMode === 'create' && (
                <FormHelperText>Select an existing domain or create a new one</FormHelperText>
              )}
            </FormControl>
            <TextField
              label="Queue Limit"
              type="number"
              fullWidth
              value={newEvent.queueLimit}
              onChange={(e) =>
                setNewEvent({ ...newEvent, queueLimit: parseInt(e.target.value, 10) || 1 })
              }
              helperText="Number of users allowed per batch"
            />
            <TextField
              label="Interval (seconds)"
              type="number"
              fullWidth
              value={newEvent.intervalSec}
              onChange={(e) =>
                setNewEvent({ ...newEvent, intervalSec: parseInt(e.target.value, 10) || 1 })
              }
              helperText="Time before the next batch is allowed in"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateEvent}
            variant="contained"
            disabled={
              creating || !newEvent.name.trim() || !newEvent.domain.trim()
            }
          >
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showCreateDomainDialog}
        onClose={() => {
          setShowCreateDomainDialog(false);
          setNewDomainName('');
          setDomainSelectMode('select');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Domain</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Domain Name"
              fullWidth
              placeholder="e.g., example.com"
              value={newDomainName}
              onChange={(e) => setNewDomainName(e.target.value)}
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCreateDomain();
                }
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowCreateDomainDialog(false);
              setNewDomainName('');
              setDomainSelectMode('select');
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateDomain}
            variant="contained"
            disabled={!newDomainName.trim()}
          >
            Create Domain
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

