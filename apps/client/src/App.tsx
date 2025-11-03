import React, { useEffect, useMemo, useState } from 'react';
import * as sdk from './sdk';
import {
  Button,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';

const API_URL = 'http://localhost:4000';

export default function App() {
  const [domain, setDomain] = useState('demo.com');
  const [events, setEvents] = useState<{ eventId: string; name: string }[]>([]);
  const [eventId, setEventId] = useState('');
  const [userId, setUserId] = useState('user-' + Math.random().toString(36).slice(2, 8));
  const [status, setStatus] = useState<{ state: string; position: number; remaining: number } | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    sdk.init({ baseUrl: API_URL });
  }, []);

  const fetchEvents = async () => {
    const u = new URL(`${API_URL}/events`);
    u.searchParams.set('domain', domain);
    const r = await fetch(u);
    const list = await r.json();
    setEvents(list);
    if (list[0]) setEventId(list[0].eventId);
  };

  const join = async () => {
    if (!eventId || !userId) return;
    const s = await sdk.joinQueue(eventId, userId);
    setStatus(s);
    setShowPopup(s.state !== 'active' && (s.remaining ?? 0) > 0);
  };

  useEffect(() => {
    if (!eventId || !userId) return;
    const stop = sdk.pollStatus(
      eventId,
      userId,
      (s) => {
        setStatus(s);
        setShowPopup(s.state !== 'active' && (s.remaining ?? 0) > 0);
      },
      1000
    );
    return stop;
  }, [eventId, userId]);

  const countdown = useMemo(() => status?.remaining ?? 0, [status]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Queue Client</Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" mb={2}>
        <TextField label="Domain" value={domain} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDomain(e.target.value)} size="small" />
        <Button variant="contained" onClick={fetchEvents}>Load Events</Button>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" mb={2}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="event-select-label">Event</InputLabel>
          <Select labelId="event-select-label" label="Event" value={eventId} onChange={(e: SelectChangeEvent<string>) => setEventId(String(e.target.value))}>
            <MenuItem value=""><em>None</em></MenuItem>
            {events.map((e) => (
              <MenuItem key={e.eventId} value={e.eventId}>{e.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField label="User ID" value={userId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserId(e.target.value)} size="small" />
        <Button variant="contained" onClick={join}>Join Queue</Button>
      </Stack>

      {status && (
        <Stack spacing={0.5}>
          <Typography>State: {status.state}</Typography>
          <Typography>Position: {status.position}</Typography>
          <Typography>Remaining: {status.remaining}s</Typography>
        </Stack>
      )}

      <Dialog open={showPopup} onClose={() => setShowPopup(false)}>
        <DialogTitle>Queue Locked</DialogTitle>
        <DialogContent>
          <Typography mb={1}>Next slot in</Typography>
          <Typography variant="h3" fontWeight={700} textAlign="center">{countdown}s</Typography>
        </DialogContent>
      </Dialog>
    </Container>
  );
}
