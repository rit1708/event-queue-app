// Styled components and theme utilities
import { styled, alpha } from '@mui/material/styles';
import { Card, Box, Paper } from '@mui/material';

export const HeroCard = styled(Card)(({ theme }) => ({
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  borderRadius: 24,
  padding: theme.spacing(4),
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
}));

export const EventCard = styled(Card)(({ theme }) => ({
  background: theme.palette.background.paper,
  border: `2px solid ${alpha('#6366f1', 0.1)}`,
  borderRadius: 20,
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
    background: `linear-gradient(90deg, #6366f1, #ec4899)`,
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
}));

export const StatBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(2),
  borderRadius: 12,
  background: alpha('#6366f1', 0.05),
  border: `1px solid ${alpha('#6366f1', 0.1)}`,
}));

export const QueueStatusCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  borderRadius: 24,
  textAlign: 'center',
  background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
  border: `2px solid ${alpha('#6366f1', 0.1)}`,
}));


