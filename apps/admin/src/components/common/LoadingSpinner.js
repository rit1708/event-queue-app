import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, CircularProgress, Typography } from '@mui/material';
export const LoadingSpinner = ({ message, fullScreen = false }) => {
    return (_jsxs(Box, { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, sx: fullScreen ? { minHeight: '100vh' } : { py: 4 }, children: [_jsx(CircularProgress, { size: 48 }), message && (_jsx(Typography, { variant: "body1", color: "text.secondary", children: message }))] }));
};
