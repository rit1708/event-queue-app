import React, { useState, useMemo } from 'react';
import {
  Container,
  Grid,
  Typography,
  Box,
  Tabs,
  Tab,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Avatar,
  Badge,
  Button,
  Stack,
  Fade,
  alpha,
} from '@mui/material';
import {
  Event as EventIcon,
  Timer as TimerIcon,
  Group as GroupIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import type { Event } from '../types';
import { useEvents } from './useEvents';
import { QueueJoinModal } from './QueueJoinModal';

export interface EventsListProps {
  userId?: string;
  onEventSelect?: (event: Event) => void;
  showTabs?: boolean;
  showHero?: boolean;
  heroTitle?: string;
  heroSubtitle?: string;
  emptyMessage?: string;
  emptyActiveMessage?: string;
  emptyInactiveMessage?: string;
  pollInterval?: number;
  autoJoin?: boolean;
  onRedirect?: (url: string) => void;
}

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }): JSX.Element {
  return (
    <div role="tabpanel" hidden={value !== index} id={`tabpanel-${index}`} aria-labelledby={`tab-${index}`}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

function EventCard({
  event,
  index,
  onClick,
  onJoin,
}: {
  event: Event;
  index: number;
  onClick: (event: Event) => void;
  onJoin?: (event: Event) => void;
}) {
  const handleJoinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onJoin) {
      onJoin(event);
    } else {
      onClick(event);
    }
  };

  return (
    <Grid item xs={12} sm={6} md={4} key={event._id}>
      <Fade in timeout={300 + index * 100}>
        <Card
          sx={{
            background: 'background.paper',
            border: `2px solid ${alpha('#6366f1', 0.1)}`,
            borderRadius: 5,
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
              background: 'linear-gradient(90deg, #6366f1, #ec4899)',
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
          }}
        >
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
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 2,
                    borderRadius: 3,
                    background: alpha('#6366f1', 0.05),
                    border: `1px solid ${alpha('#6366f1', 0.1)}`,
                  }}
                >
                  <GroupIcon fontSize="small" color="primary" />
                  <Typography variant="body2" color="text.secondary">
                    Limit: <strong>{event.queueLimit}</strong> per batch
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 2,
                    borderRadius: 3,
                    background: alpha('#6366f1', 0.05),
                    border: `1px solid ${alpha('#6366f1', 0.1)}`,
                  }}
                >
                  <TimerIcon fontSize="small" color="primary" />
                  <Typography variant="body2" color="text.secondary">
                    Interval: <strong>{event.intervalSec}s</strong>
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mt: 2,
                  }}
                >
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
                    onClick={handleJoinClick}
                  >
                    Join
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </CardActionArea>
        </Card>
      </Fade>
    </Grid>
  );
}

export function EventsList({
  userId,
  onEventSelect,
  showTabs = true,
  showHero = true,
  heroTitle = 'Queue Management System',
  heroSubtitle = 'Join events and manage your queue position in real-time',
  emptyMessage = 'No events available',
  emptyActiveMessage = 'No active events',
  emptyInactiveMessage = 'No inactive events',
  pollInterval = 2000,
  autoJoin = true,
  onRedirect,
}: EventsListProps) {
  const [tabValue, setTabValue] = useState(0);
  const [joinEvent, setJoinEvent] = useState<Event | null>(null);
  const { events, loading, error, refetch } = useEvents();

  const activeEvents = useMemo(() => events.filter((e) => e.isActive), [events]);
  const inactiveEvents = useMemo(() => events.filter((e) => !e.isActive), [events]);

  const handleJoin = (event: Event) => {
    if (!event.isActive) {
      console.warn('Cannot join inactive event:', event.name);
      return;
    }
    console.log('Join button clicked for event:', event.name, 'Event ID:', event._id, 'User ID:', userId);
    setJoinEvent(event);
  };

  const handleEventSelect = (event: Event) => {
    if (onEventSelect) {
      onEventSelect(event);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Loading events...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center', p: 4 }}>
          <Typography variant="h6" color="error" gutterBottom>
            {error}
          </Typography>
          <Button variant="contained" onClick={() => refetch()} sx={{ mt: 2 }}>
            Retry
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {showHero && (
        <Card
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: 6,
            p: 4,
            mb: 4,
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
          }}
        >
          <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
            {heroTitle}
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9 }}>
            {heroSubtitle}
          </Typography>
        </Card>
      )}

      {showTabs && (
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
            <Tab label={`All Events (${events.length})`} />
            <Tab label={`Active (${activeEvents.length})`} />
            <Tab label={`Inactive (${inactiveEvents.length})`} />
          </Tabs>
        </Box>
      )}

      {showTabs ? (
        <>
          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              {events.map((event, index) => (
                <EventCard
                  key={event._id}
                  event={event}
                  index={index}
                  onClick={handleEventSelect}
                  onJoin={handleJoin}
                />
              ))}
              {events.length === 0 && (
                <Grid item xs={12}>
                  <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                    {emptyMessage}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Grid container spacing={3}>
              {activeEvents.map((event, index) => (
                <EventCard
                  key={event._id}
                  event={event}
                  index={index}
                  onClick={handleEventSelect}
                  onJoin={handleJoin}
                />
              ))}
              {activeEvents.length === 0 && (
                <Grid item xs={12}>
                  <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                    {emptyActiveMessage}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Grid container spacing={3}>
              {inactiveEvents.map((event, index) => (
                <EventCard
                  key={event._id}
                  event={event}
                  index={index}
                  onClick={handleEventSelect}
                  onJoin={handleJoin}
                />
              ))}
              {inactiveEvents.length === 0 && (
                <Grid item xs={12}>
                  <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                    {emptyInactiveMessage}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </TabPanel>
        </>
      ) : (
        <Grid container spacing={3}>
          {events.map((event, index) => (
            <EventCard
              key={event._id}
              event={event}
              index={index}
              onClick={handleEventSelect}
              onJoin={handleJoin}
            />
          ))}
          {events.length === 0 && (
            <Grid item xs={12}>
              <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                {emptyMessage}
              </Typography>
            </Grid>
          )}
        </Grid>
      )}

      {/* Queue Join Modal - Managed by SDK */}
      {joinEvent && userId && (
        <QueueJoinModal
          key={joinEvent._id}
          eventId={joinEvent._id}
          userId={userId}
          event={joinEvent}
          open={true}
          autoJoin={autoJoin}
          pollInterval={pollInterval}
          onClose={() => {
            setJoinEvent(null);
          }}
          onRedirect={onRedirect}
        />
      )}
    </Container>
  );
}

