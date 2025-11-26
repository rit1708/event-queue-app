// Type definitions for the client app
import type { Event, QueueStatus } from 'queue-sdk';

export type { Event, QueueStatus };

export interface SnackbarState {
  open: boolean;
  message: string;
  severity?: 'success' | 'error' | 'warning' | 'info';
}

export interface AppState {
  events: Event[];
  selectedEvent: Event | null;
  queueStatus: QueueStatus | null;
  loading: boolean;
  error: string | null;
}

export interface QueueState {
  position: number | null;
  waitTime: number;
  waitDuration: number;
  showQueueFull: boolean;
}


