import { useState } from 'react';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { HomePage } from './pages/HomePage';
import { QueuePage } from './pages/QueuePage';
import { AppSnackbar } from './components/common/Snackbar';
import { useSnackbar } from './hooks/useSnackbar';
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

  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event);
  };

  const handleBack = () => {
    setSelectedEvent(null);
  };

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
