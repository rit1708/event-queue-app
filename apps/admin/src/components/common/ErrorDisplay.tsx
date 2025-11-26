import { Alert, AlertTitle, Box, Button } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';

interface ErrorDisplayProps {
  message: string;
  onRetry?: () => void;
  fullWidth?: boolean;
}

export const ErrorDisplay = ({ message, onRetry, fullWidth = false }: ErrorDisplayProps) => {
  return (
    <Box sx={fullWidth ? { width: '100%' } : { p: 2 }}>
      <Alert
        severity="error"
        action={
          onRetry && (
            <Button color="inherit" size="small" onClick={onRetry} startIcon={<RefreshIcon />}>
              Retry
            </Button>
          )
        }
      >
        <AlertTitle>Error</AlertTitle>
        {message}
      </Alert>
    </Box>
  );
};


