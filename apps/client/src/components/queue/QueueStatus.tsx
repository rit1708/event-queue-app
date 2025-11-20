import {
  Box,
  Typography,
  LinearProgress,
  Chip,
  Stack,
  CircularProgress,
} from '@mui/material';
import {
  HourglassEmpty as HourglassEmptyIcon,
  CheckCircle as CheckCircleIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import type { QueueStatus as QueueStatusType } from 'queue-sdk';
import { QueueStatusCard } from '../../styles/theme';

interface QueueStatusProps {
  status: QueueStatusType | null;
  loading?: boolean;
}

export const QueueStatus = ({ status, loading }: QueueStatusProps) => {
  if (loading) {
    return (
      <QueueStatusCard>
        <CircularProgress size={48} />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Loading queue status...
        </Typography>
      </QueueStatusCard>
    );
  }

  if (!status) {
    return (
      <QueueStatusCard>
        <Typography variant="h6" color="text.secondary">
          No queue status available
        </Typography>
      </QueueStatusCard>
    );
  }

  const isActive = status.state === 'active';
  const isWaiting = status.state === 'waiting';
  const progress = status.total > 0 ? (status.position / status.total) * 100 : 0;

  return (
    <QueueStatusCard>
      <Box sx={{ mb: 3 }}>
        {isActive ? (
          <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
        ) : (
          <HourglassEmptyIcon sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
        )}
        <Typography variant="h4" gutterBottom fontWeight="bold">
          {isActive ? 'You\'re In!' : 'Waiting in Queue'}
        </Typography>
        <Chip
          label={isActive ? 'Active' : `Position: ${status.position}`}
          color={isActive ? 'success' : 'warning'}
          sx={{ mt: 1, fontWeight: 600 }}
        />
      </Box>

      {isWaiting && (
        <Box sx={{ width: '100%', mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Queue Progress
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {status.position} / {status.total}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
      )}

      <Stack spacing={2} sx={{ mt: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccessTimeIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              Time Remaining
            </Typography>
          </Box>
          <Typography variant="h6" fontWeight="bold">
            {Math.floor(status.timeRemaining / 60)}:{(status.timeRemaining % 60).toString().padStart(2, '0')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Active Users
          </Typography>
          <Typography variant="body1" fontWeight="bold">
            {status.activeUsers}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Waiting Users
          </Typography>
          <Typography variant="body1" fontWeight="bold">
            {status.waitingUsers}
          </Typography>
        </Box>
      </Stack>
    </QueueStatusCard>
  );
};

