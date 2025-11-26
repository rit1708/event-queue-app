import type { InitOptions } from './types';

interface SDKConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  retryDelay: number;
  enableLogging: boolean;
  headers: Record<string, string>;
}

let config: SDKConfig = {
  baseUrl: '/api',
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  enableLogging: false,
  headers: {},
};

function getDefaultBaseUrl(): string {
  if (typeof window !== 'undefined' && (window as any).__QUEUE_API_URL__) {
    return String((window as any).__QUEUE_API_URL__).replace(/\/$/, '');
  }

  try {
    const metaEnv = (import.meta as any)?.env;
    if (metaEnv?.VITE_API_URL) {
      const url = String(metaEnv.VITE_API_URL);
      if (url) return url.replace(/\/$/, '');
    }
  } catch {
    // import.meta might not be available
  }

  if (typeof process !== 'undefined' && process.env?.VITE_API_URL) {
    return String(process.env.VITE_API_URL).replace(/\/$/, '');
  }

  return '/api';
}

export function init(options?: InitOptions): void {
  if (options?.baseUrl) {
    config.baseUrl = options.baseUrl.replace(/\/$/, '');
  } else {
    config.baseUrl = getDefaultBaseUrl();
  }

  if (options?.timeout !== undefined) {
    config.timeout = options.timeout;
  }

  if (options?.retries !== undefined) {
    config.retries = options.retries;
  }

  if (options?.retryDelay !== undefined) {
    config.retryDelay = options.retryDelay;
  }

  if (options?.enableLogging !== undefined) {
    config.enableLogging = options.enableLogging;
  }

  if (options?.headers) {
    config.headers = { ...config.headers, ...options.headers };
  }
}

export function getConfig(): Readonly<SDKConfig> {
  return { ...config };
}

export function getBaseUrl(): string {
  return config.baseUrl;
}

function log(message: string, ...args: unknown[]): void {
  if (config.enableLogging) {
    console.log(`[QueueSDK] ${message}`, ...args);
  }
}

export { log };

