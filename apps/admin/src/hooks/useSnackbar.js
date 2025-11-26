import { useState, useCallback } from 'react';
export const useSnackbar = () => {
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info',
    });
    const showMessage = useCallback((message, severity = 'info') => {
        setSnackbar({ open: true, message, severity });
    }, []);
    const showError = useCallback((message) => {
        showMessage(message, 'error');
    }, [showMessage]);
    const showSuccess = useCallback((message) => {
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
