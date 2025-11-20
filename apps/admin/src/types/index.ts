// Type definitions for the admin app
import type { Event } from 'queue-sdk';

export type { Event };

export interface QueueData {
  active: string[];
  waiting: string[];
  remaining: number;
}

export interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

export interface HistoryPoint {
  t: number;
  active: number;
  waiting: number;
}

export interface NewEventForm {
  name: string;
  domain: string;
  queueLimit: number;
  intervalSec: number;
}

