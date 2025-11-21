// Type definitions for the Queue Management API

export interface Event {
  _id: string;
  name: string;
  domain: string;
  queueLimit: number;
  intervalSec: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Domain {
  _id: string;
  name: string;
  createdAt?: Date;
}

export interface QueueStatus {
  state: 'waiting' | 'active' | 'completed';
  position: number;
  total: number;
  timeRemaining: number;
  activeUsers: number;
  waitingUsers: number;
  showWaitingTimer?: boolean; // Whether to show the 45-second waiting timer
  waitingTimerDuration?: number; // Duration of waiting timer in seconds (45)
}

export interface QueueUsers {
  active: string[];
  waiting: string[];
  remaining: number;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

