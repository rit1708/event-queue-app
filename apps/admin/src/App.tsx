import React, { useEffect, useState } from 'react';
import { Button, Container, Stack, TextField, Typography, Paper, FormControl, InputLabel, Select, MenuItem } from '@mui/material';

const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000';

export default function App() {
  const [domain, setDomain] = useState('demo.com');
  const [eventName, setEventName] = useState('Launch');
  const [queueLimit, setQueueLimit] = useState(2);
  const [intervalSec, setIntervalSec] = useState(30);
  const [eventId, setEventId] = useState('');
  const [msg, setMsg] = useState('');
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const [waitingUsers, setWaitingUsers] = useState<string[]>([]);
  const [events, setEvents] = useState<{ eventId: string; name: string }[]>([]);
  const [remaining, setRemaining] = useState<number>(0);
  const [newUserId, setNewUserId] = useState<string>('user-' + Math.random().toString(36).slice(2, 8));
  const [entries, setEntries] = useState<{ eventId: string; userId: string; enteredAt: string }[]>([]);

  const createDomain = async () => {
    const r = await fetch(`${API_URL}/admin/domain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: domain }),
    });
    setMsg(await r.text());
  };

  const startWindow = async () => {
    if (!eventId) return;
    await fetch(`${API_URL}/admin/event/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId })
    });
    await Promise.all([loadUsers(), loadEntries()]);
  };

  const advanceNow = async () => {
    if (!eventId) return;
    await fetch(`${API_URL}/admin/event/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId })
    });
    await Promise.all([loadUsers(), loadEntries()]);
  };
  const createEvent = async () => {
    const r = await fetch(`${API_URL}/admin/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, name: eventName, queueLimit, intervalSec }),
    });
    const j = await r.json();
    setEventId(j.eventId || '');
    setMsg(JSON.stringify(j, null, 2));
  };
  const updateConfig = async () => {
    if (!eventId) return;
    const r = await fetch(`${API_URL}/admin/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, queueLimit, intervalSec }),
    });
    setMsg(await r.text());
  };

  const loadUsers = async () => {
    if (!eventId) return;
    const u = new URL(`${API_URL}/admin/event/users`);
    u.searchParams.set('eventId', eventId);
    const r = await fetch(u);
    if (!r.ok) {
      setMsg(await r.text());
      return;
    }
    const j = (await r.json()) as { active: string[]; waiting: string[]; remaining: number };
    setActiveUsers(j.active || []);
    setWaitingUsers(j.waiting || []);
    setRemaining(j.remaining ?? 0);
  };

  const loadEvents = async () => {
    const u = new URL(`${API_URL}/events`);
    u.searchParams.set('domain', domain);
    const r = await fetch(u);
    if (!r.ok) {
      setMsg(await r.text());
      return;
    }
    const list = (await r.json()) as { eventId: string; name: string }[];
    setEvents(list);
    if (list[0]) setEventId(list[0].eventId);
  };

  useEffect(() => {
    if (!eventId) return;
    const id = setInterval(loadUsers, 1000);
    loadUsers();
    return () => clearInterval(id);
  }, [eventId]);

  const loadEntries = async () => {
    if (!eventId) return;
    const u = new URL(`${API_URL}/admin/event/entries`);
    u.searchParams.set('eventId', eventId);
    const r = await fetch(u);
    if (!r.ok) return;
    const list = (await r.json()) as { eventId: string; userId: string; enteredAt: string }[];
    setEntries(list);
  };
  useEffect(() => {
    if (!eventId) return;
    const id = setInterval(loadEntries, 2000);
    loadEntries();
    return () => clearInterval(id);
  }, [eventId]);

  const enqueueUserApi = async () => {
    if (!eventId || !newUserId) return;
    const r = await fetch(`${API_URL}/admin/event/enqueue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, userId: newUserId })
    });
    if (!r.ok) setMsg(await r.text());
    await loadUsers();
  };

  const enqueueBatch = async (count: number) => {
    if (!eventId) return;
    const r = await fetch(`${API_URL}/admin/event/enqueue-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, count })
    });
    if (!r.ok) setMsg(await r.text());
    await loadUsers();
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Admin</Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>Domain</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField label="Domain" value={domain} onChange={(e) => setDomain(e.target.value)} size="small" />
          <Button variant="contained" onClick={createDomain}>Create Domain</Button>
          <Button variant="outlined" onClick={loadEvents}>Load Events</Button>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="event-select">Event</InputLabel>
            <Select labelId="event-select" label="Event" value={eventId} onChange={(e) => setEventId(String(e.target.value))}>
              <MenuItem value=""><em>None</em></MenuItem>
              {events.map((e) => (
                <MenuItem key={e.eventId} value={e.eventId}>{e.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>Create Event</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField label="Name" value={eventName} onChange={(e) => setEventName(e.target.value)} size="small" />
          <TextField label="Queue Limit" type="number" value={queueLimit} onChange={(e) => setQueueLimit(Number(e.target.value))} size="small" />
          <TextField label="Interval (sec)" type="number" value={intervalSec} onChange={(e) => setIntervalSec(Number(e.target.value))} size="small" />
          <Button variant="contained" onClick={createEvent}>Create Event</Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>Update Config</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField label="Event ID" value={eventId} onChange={(e) => setEventId(e.target.value)} size="small" fullWidth />
          <TextField label="Queue Limit" type="number" value={queueLimit} onChange={(e) => setQueueLimit(Number(e.target.value))} size="small" />
          <TextField label="Interval (sec)" type="number" value={intervalSec} onChange={(e) => setIntervalSec(Number(e.target.value))} size="small" />
          <Button variant="contained" onClick={updateConfig}>Save</Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>Users in Event</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
          <TextField label="Event ID" value={eventId} onChange={(e) => setEventId(e.target.value)} size="small" fullWidth />
          <Button variant="outlined" onClick={loadUsers}>Refresh</Button>
          <Typography sx={{ alignSelf: 'center' }}>Remaining: {remaining}s</Typography>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
          <TextField label="User ID" value={newUserId} onChange={(e) => setNewUserId(e.target.value)} size="small" />
          <Button variant="contained" onClick={enqueueUserApi}>Enqueue User</Button>
          <Button variant="outlined" onClick={() => enqueueBatch(5)}>Enqueue 5</Button>
          <Button variant="outlined" color="success" onClick={startWindow}>Start Window</Button>
          <Button variant="outlined" color="warning" onClick={advanceNow}>Advance Now</Button>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4}>
          <div>
            <Typography variant="subtitle1">Active</Typography>
            <pre style={{ margin: 0 }}>{JSON.stringify(activeUsers, null, 2)}</pre>
          </div>
          <div>
            <Typography variant="subtitle1">Waiting</Typography>
            <pre style={{ margin: 0 }}>{JSON.stringify(waitingUsers, null, 2)}</pre>
          </div>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Entry History</Typography>
        <Button size="small" variant="outlined" onClick={loadEntries} sx={{ mb: 1 }}>Refresh History</Button>
        <pre style={{ margin: 0, maxHeight: 300, overflow: 'auto' }}>{JSON.stringify(entries, null, 2)}</pre>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Response</Typography>
        <pre style={{ margin: 0 }}>{msg}</pre>
      </Paper>
    </Container>
  );
}
