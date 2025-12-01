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

export interface QueueUsers {
  active: string[];
  waiting: string[];
  remaining: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface JoinQueueResponse {
  success: boolean;
  status?: string;
  position?: number;
  state?: QueueStatus['state'];
  total?: number;
  timeRemaining?: number;
  activeUsers?: number;
  waitingUsers?: number;
  message?: string;
  waitTime?: number;
  showWaitingTimer?: boolean; // Whether to show the 45-second waiting timer
  waitingTimerDuration?: number; // Duration of waiting timer in seconds (45)
}

export interface InitOptions {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  enableLogging?: boolean;
  headers?: Record<string, string>;
  token?: string;
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeout?: number;
  retries?: number;
}

export interface PollOptions {
  intervalMs?: number;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

export class SDKError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public response?: unknown
  ) {
    super(message);
    this.name = 'SDKError';
    Object.setPrototypeOf(this, SDKError.prototype);
  }
}

export class NetworkError extends SDKError {
  public originalError?: Error;

  constructor(
    message: string = 'Network request failed',
    originalError?: Error
  ) {
    super(message, undefined, 'NETWORK_ERROR');
    this.name = 'NetworkError';
    this.originalError = originalError;
  }
}

export class TimeoutError extends SDKError {
  constructor(message: string = 'Request timeout') {
    super(message, undefined, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
  }
}

export class ValidationError extends SDKError {
  constructor(
    message: string,
    public details?: unknown
  ) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}
