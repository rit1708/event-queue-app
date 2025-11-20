// Styled components for admin app
import { styled, alpha } from '@mui/material/styles';
import { Drawer, Card, Box } from '@mui/material';

export const drawerWidth = 260;

export const SidebarDrawer = styled(Drawer)(({ theme }) => ({
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

export const KPICard = styled(Card)(({ theme }) => ({
  background: theme.palette.background.paper,
  borderRadius: 12,
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
  },
}));

export const MainContent = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  backgroundColor: '#f5f7fa',
  minHeight: '100vh',
  padding: theme.spacing(3),
}));

