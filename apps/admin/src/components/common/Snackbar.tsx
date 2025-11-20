import { Snackbar as MuiSnackbar, Alert } from '@mui/material';
import type { SnackbarState } from '../../types';

interface AppSnackbarProps {
  snackbar: SnackbarState;
  onClose: () => void;
}

export const AppSnackbar = ({ snackbar, onClose }: AppSnackbarProps) => {
  return (
    <MuiSnackbar
      open={snackbar.open}
      autoHideDuration={6000}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        onClose={onClose}
        severity={snackbar.severity}
        variant="filled"
        sx={{ width: '100%' }}
      >
        {snackbar.message}
      </Alert>
    </MuiSnackbar>
  );
};

