import { jsx as _jsx } from "react/jsx-runtime";
import { Snackbar as MuiSnackbar, Alert } from '@mui/material';
export const AppSnackbar = ({ snackbar, onClose }) => {
    return (_jsx(MuiSnackbar, { open: snackbar.open, autoHideDuration: 6000, onClose: onClose, anchorOrigin: { vertical: 'bottom', horizontal: 'center' }, children: _jsx(Alert, { onClose: onClose, severity: snackbar.severity, variant: "filled", sx: { width: '100%' }, children: snackbar.message }) }));
};
