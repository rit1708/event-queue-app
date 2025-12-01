import { getConfig, log } from './config';
import { SDKError, NetworkError, TimeoutError } from './types';

interface RequestConfig {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal
        ? AbortSignal.any([controller.signal, options.signal])
        : controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

async function requestWithRetry<T>(
  url: string,
  config: RequestConfig,
  retries: number
): Promise<T> {
  const cfg = getConfig();
  const maxRetries = config.retries ?? retries ?? cfg.retries;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const timeout = config.timeout ?? cfg.timeout;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...cfg.headers,
        ...config.headers,
      };

      // Add Authorization header if token is configured
      if (cfg.token) {
        headers['Authorization'] = `Bearer ${cfg.token}`;
      }

      const fetchOptions: RequestInit = {
        method: config.method || 'GET',
        headers,
        signal: config.signal,
      };

      if (config.body) {
        fetchOptions.body = JSON.stringify(config.body);
      }

      log(`Request: ${config.method || 'GET'} ${url}`, { attempt: attempt + 1 });

      const response = await fetchWithTimeout(url, fetchOptions, timeout);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          } else if (typeof errorData === 'string') {
            errorMessage = errorData;
          }
        } catch {
          const text = await response.text().catch(() => '');
          if (text) errorMessage = text;
        }

        const error = new SDKError(
          errorMessage,
          response.status,
          response.status >= 400 && response.status < 500 ? 'CLIENT_ERROR' : 'SERVER_ERROR'
        );

        if (response.status >= 500 && attempt < maxRetries) {
          lastError = error;
          const delay = cfg.retryDelay * Math.pow(2, attempt);
          log(`Retrying after ${delay}ms...`, { attempt: attempt + 1, maxRetries });
          await sleep(delay);
          continue;
        }

        throw error;
      }

      const data = await response.json().catch((e) => {
        throw new SDKError('Invalid JSON response from server', response.status, 'PARSE_ERROR');
      });

      log(`Response: ${config.method || 'GET'} ${url}`, { status: response.status });
      return data;
    } catch (error) {
      if (error instanceof SDKError || error instanceof TimeoutError) {
        if (attempt < maxRetries && error.statusCode && error.statusCode >= 500) {
          lastError = error;
          const delay = cfg.retryDelay * Math.pow(2, attempt);
          log(`Retrying after ${delay}ms...`, { attempt: attempt + 1, maxRetries });
          await sleep(delay);
          continue;
        }
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError' && config.signal?.aborted) {
          throw new SDKError('Request aborted', undefined, 'ABORTED');
        }

        if (attempt < maxRetries) {
          lastError = new NetworkError('Network request failed', error);
          const delay = cfg.retryDelay * Math.pow(2, attempt);
          log(`Retrying after ${delay}ms...`, { attempt: attempt + 1, maxRetries });
          await sleep(delay);
          continue;
        }

        throw new NetworkError('Network request failed', error);
      }

      throw error;
    }
  }

  throw lastError || new NetworkError('Request failed after all retries');
}

export async function get<T>(path: string, options?: RequestConfig): Promise<T> {
  const cfg = getConfig();
  const url = `${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  return requestWithRetry<T>(url, { ...options, method: 'GET' }, cfg.retries);
}

export async function post<T>(path: string, body?: unknown, options?: RequestConfig): Promise<T> {
  const cfg = getConfig();
  const url = `${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  return requestWithRetry<T>(url, { ...options, method: 'POST', body }, cfg.retries);
}

export async function put<T>(path: string, body?: unknown, options?: RequestConfig): Promise<T> {
  const cfg = getConfig();
  const url = `${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  return requestWithRetry<T>(url, { ...options, method: 'PUT', body }, cfg.retries);
}

export async function del<T>(path: string, options?: RequestConfig): Promise<T> {
  const cfg = getConfig();
  const url = `${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  return requestWithRetry<T>(url, { ...options, method: 'DELETE' }, cfg.retries);
}


