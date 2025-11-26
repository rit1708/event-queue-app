import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Alert, AlertTitle, Box, Button } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
export const ErrorDisplay = ({ message, onRetry, fullWidth = false }) => {
    return (_jsx(Box, { sx: fullWidth ? { width: '100%' } : { p: 2 }, children: _jsxs(Alert, { severity: "error", action: onRetry && (_jsx(Button, { color: "inherit", size: "small", onClick: onRetry, startIcon: _jsx(RefreshIcon, {}), children: "Retry" })), children: [_jsx(AlertTitle, { children: "Error" }), message] }) }));
};
