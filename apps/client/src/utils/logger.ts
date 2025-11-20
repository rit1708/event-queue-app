// Simple logger utility for client app

const isDevelopment = import.meta.env.DEV;

export const logger = {
  debug: (message: string, ...args: unknown[]): void => {
    if (isDevelopment) {
      console.debug(`[Client] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: unknown[]): void => {
    if (isDevelopment) {
      console.log(`[Client] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: unknown[]): void => {
    console.warn(`[Client] ${message}`, ...args);
  },
  error: (message: string, error?: unknown, ...args: unknown[]): void => {
    console.error(`[Client] ${message}`, error, ...args);
  },
};

