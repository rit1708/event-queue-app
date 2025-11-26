// Simple logger utility for admin app
const isDevelopment = import.meta.env.DEV;
export const logger = {
    debug: (message, ...args) => {
        if (isDevelopment) {
            console.debug(`[Admin] ${message}`, ...args);
        }
    },
    info: (message, ...args) => {
        if (isDevelopment) {
            console.log(`[Admin] ${message}`, ...args);
        }
    },
    warn: (message, ...args) => {
        console.warn(`[Admin] ${message}`, ...args);
    },
    error: (message, error, ...args) => {
        console.error(`[Admin] ${message}`, error, ...args);
    },
};
