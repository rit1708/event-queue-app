import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Plugin to filter Console Ninja messages
const filterConsoleNinjaPlugin = () => {
  return {
    name: 'filter-console-ninja',
    configureServer(server) {
      // Override logger methods to filter Console Ninja messages
      const originalInfo = server.config.logger.info;
      const originalWarn = server.config.logger.warn;
      const originalWarnOnce = server.config.logger.warnOnce;
      
      const shouldFilter = (msg: any) => {
        const msgStr = typeof msg === 'string' ? msg : String(msg);
        return msgStr.includes('Console Ninja') || 
               msgStr.includes('vite v5.4.21 is not yet supported in the Community edition');
      };
      
      server.config.logger.info = (msg, options) => {
        if (shouldFilter(msg)) return;
        return originalInfo(msg, options);
      };
      
      server.config.logger.warn = (msg, options) => {
        if (shouldFilter(msg)) return;
        return originalWarn(msg, options);
      };
      
      server.config.logger.warnOnce = (msg, options) => {
        if (shouldFilter(msg)) return;
        return originalWarnOnce(msg, options);
      };
    },
  };
};

export default defineConfig({
  plugins: [react(), filterConsoleNinjaPlugin()],
  server: { 
    host: '0.0.0.0', 
    port: 5174,
    allowedHosts: true,
    hmr: {
      host: 'event-queue-app-production.up.railway.app',
      protocol: 'wss',
      clientPort: 443,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'mui-vendor': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          'charts-vendor': ['@mui/x-charts'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
