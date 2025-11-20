import { useState, useCallback } from 'react';
import type { SnackbarState } from '../types';

export const useSnackbar = () => {
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'info',
  });

  const showMessage = useCallback((message: string, severity: SnackbarState['severity'] = 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const showError = useCallback((message: string) => {
    showMessage(message, 'error');
  }, [showMessage]);

  const showSuccess = useCallback((message: string) => {
    showMessage(message, 'success');
  }, [showMessage]);

  const closeSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    snackbar,
    showMessage,
    showError,
    showSuccess,
    closeSnackbar,
  };
};

