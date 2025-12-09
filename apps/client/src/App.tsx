import { useState, useEffect } from 'react';
import { CssBaseline, ThemeProvider, createTheme, Box, Alert, Typography } from '@mui/material';
import { HomePage } from './pages/HomePage';
import { QueuePage } from './pages/QueuePage';
import { AppSnackbar } from './components/common/Snackbar';
import { useSnackbar } from './hooks/useSnackbar';
import * as sdk from 'queue-sdk';
import type { Event } from 'queue-sdk';

const theme = createTheme({
  palette: {
    primary: {
      main: '#6366f1',
    },
    secondary: {
      main: '#ec4899',
    },
  },
});

function App() {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [userId] = useState(() => 'user-' + Math.random().toString(36).slice(2, 10));
  const { snackbar, closeSnackbar } = useSnackbar();
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Initialize SDK with token using sdk.init()
  useEffect(() => {
    const initializeToken = () => {
      // Initialize SDK with the token
      const token = '49685bda848d83a35d4570e1975cac8ad71833aeb2f750d83dfb31c561bcf6a4';
      
      // Use sdk.init() to set the token
      sdk.init({ token });
      
      // Also save to localStorage for persistence
      if (typeof window !== 'undefined') {
        try {
          sdk.saveTokenToStorage(token);
          // Verify token is set
          const verifyToken = sdk.getToken();
          if (!verifyToken) {
            console.error('[App] WARNING: Token was set but getToken() returns undefined!');
          } else {
            console.log('[App] SDK initialized with token, length:', verifyToken.length);
          }
        } catch (e) {
          console.error('[App] Error saving token to storage:', e);
        }
      }

      return token;
    };

    const checkToken = async () => {
      const token = initializeToken();
      
      // Token is optional for viewing events, so we don't block the app
      // Token will be required when user tries to join queue
      if (token) {
        // Validate token by making a test API call (optional - events don't require token)
        try {
          // Just set token, don't validate with API call since events don't need token
          setHasToken(true);
          setTokenError(null);
        } catch (err: any) {
          // If validation fails, still allow viewing events but token won't work for queue
          setHasToken(false);
          setTokenError('Token may be invalid. You can view events but joining queue will require a valid token.');
        }
      } else {
        // No token - allow viewing events but warn about queue operations
        setHasToken(false);
        setTokenError(null); // Don't show error, just allow viewing events
      }
    };

    checkToken();
  }, []);

  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event);
  };

  const handleBack = () => {
    setSelectedEvent(null);
  };

  // Don't block app if token is missing - allow viewing events
  // Token will be required when user tries to join queue (handled in queue hooks)

  // Show loading state while checking token
  if (hasToken === null) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Loading state */}
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {selectedEvent ? (
        <QueuePage event={selectedEvent} userId={userId} onBack={handleBack} />
      ) : (
        <HomePage onEventSelect={handleEventSelect} />
      )}
      <AppSnackbar snackbar={snackbar} onClose={closeSnackbar} />
    </ThemeProvider>
  );
}

export default App;
