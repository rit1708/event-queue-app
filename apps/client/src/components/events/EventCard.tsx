import { memo } from 'react';
import {
  Grid,
  CardActionArea,
  CardContent,
  Box,
  Typography,
  Chip,
  Avatar,
  Badge,
  Button,
  Stack,
  Fade,
} from '@mui/material';
import {
  Event as EventIcon,
  Timer as TimerIcon,
  Group as GroupIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { alpha } from '@mui/material';
import type { Event } from 'queue-sdk';
import { EventCard as StyledEventCard, StatBox } from '../../styles/theme';

interface EventCardProps {
  event: Event;
  index: number;
  onClick: (event: Event) => void;
  onJoin?: (event: Event) => void;
}

export const EventCard = memo(function EventCard({ event, index, onClick, onJoin }: EventCardProps) {
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
        <StyledEventCard>
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
        </StyledEventCard>
      </Fade>
    </Grid>
  );
});

