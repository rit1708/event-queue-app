import { useState, useMemo } from 'react';
import {
  Container,
  Grid,
  Typography,
  Box,
  Tabs,
  Tab,
} from '@mui/material';
import { useEvents } from '../hooks/useEvents';
import { EventCard } from '../components/events/EventCard';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorDisplay } from '../components/common/ErrorDisplay';
import { HeroCard } from '../styles/theme';
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

  const activeEvents = useMemo(() => events.filter((e) => e.isActive), [events]);
  const inactiveEvents = useMemo(() => events.filter((e) => !e.isActive), [events]);

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
            <EventCard key={event._id} event={event} index={index} onClick={onEventSelect} />
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
            <EventCard key={event._id} event={event} index={index} onClick={onEventSelect} />
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
            <EventCard key={event._id} event={event} index={index} onClick={onEventSelect} />
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
    </Container>
  );
};

