// Simple logger utility for admin app

const isDevelopment = import.meta.env.DEV;

export const logger = {
  debug: (message: string, ...args: unknown[]): void => {
    if (isDevelopment) {
      console.debug(`[Admin] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: unknown[]): void => {
    if (isDevelopment) {
      console.log(`[Admin] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: unknown[]): void => {
    console.warn(`[Admin] ${message}`, ...args);
  },
  error: (message: string, error?: unknown, ...args: unknown[]): void => {
    console.error(`[Admin] ${message}`, error, ...args);
  },
};


