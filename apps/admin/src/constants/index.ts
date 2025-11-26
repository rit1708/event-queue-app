// Application constants for admin app

export const DEFAULT_QUEUE_LIMIT = 2;
export const DEFAULT_INTERVAL_SEC = 30;
export const POLL_INTERVAL_MS = 2000;
export const HISTORY_LIMIT = 30;

export const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'Dashboard' },
  { id: 'events', label: 'Events', icon: 'Event' },
  { id: 'users', label: 'Users', icon: 'People' },
  { id: 'analytics', label: 'Analytics', icon: 'BarChart' },
  { id: 'settings', label: 'Settings', icon: 'Settings' },
] as const;


