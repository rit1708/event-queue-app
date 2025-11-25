# Queue SDK

A production-ready, enterprise-grade SDK for the Queue Management System. Built with 5+ years of industry best practices, featuring automatic retries, request cancellation, error handling, and more.

## Features

- ✅ **Auto-detection**: Automatically detects API URL from environment variables or uses relative paths
- ✅ **Zero configuration**: Works out of the box without manual initialization
- ✅ **Retry logic**: Automatic retry with exponential backoff for failed requests
- ✅ **Request cancellation**: Full AbortController support for canceling requests
- ✅ **Timeout handling**: Configurable request timeouts
- ✅ **Error handling**: Custom error classes with detailed error information
- ✅ **Type safety**: Full TypeScript support with comprehensive type definitions
- ✅ **Request/response logging**: Optional logging for debugging
- ✅ **Input validation**: Built-in parameter validation
- ✅ **CDN ready**: Can be served as a CDN from the API server
- ✅ **NPM package**: Can be installed as an npm package

## Installation

### As NPM Package

```bash
npm install queue-sdk
```

### As CDN (from API server)

```html
<script type="module">
  import * as sdk from 'https://your-api-domain.com/api/sdk';
  // Use SDK directly
</script>
```

## Quick Start

### Basic Usage (Auto-detection)

```typescript
import * as sdk from 'queue-sdk';
import type { Event, QueueStatus } from 'queue-sdk';

// No initialization needed - SDK auto-detects API URL
const events: Event[] = await sdk.getEvents();
```

### Advanced Configuration

```typescript
import { init } from 'queue-sdk';

// Initialize with custom options
init({
  baseUrl: 'https://api.example.com/api',
  timeout: 30000,        // Request timeout in ms (default: 30000)
  retries: 3,            // Number of retries (default: 3)
  retryDelay: 1000,      // Initial retry delay in ms (default: 1000)
  enableLogging: true,   // Enable request/response logging
  headers: {             // Custom headers
    'Authorization': 'Bearer token',
  },
});
```

## API Methods

### Event Methods

```typescript
// Get all events
const events: Event[] = await sdk.getEvents();

// Get specific event
const event: Event = await sdk.getEvent('event-id');
```

### Queue Methods

```typescript
// Join queue
const result = await sdk.joinQueue('event-id', 'user-id');

// Get queue status
const status: QueueStatus = await sdk.getQueueStatus('event-id', 'user-id');

// Poll queue status with options
const cleanup = sdk.pollStatus(
  'event-id',
  'user-id',
  (status) => {
    console.log('Queue position:', status.position);
  },
  {
    intervalMs: 2000,           // Polling interval
    onError: (error) => {        // Error handler
      console.error('Polling error:', error);
    },
    signal: abortController.signal, // Abort signal
  }
);

// Stop polling
cleanup();
```

### Admin Methods

```typescript
// Create domain
const domain = await sdk.createDomain('example.com');

// Create event
const event = await sdk.createEvent({
  domain: 'example.com',
  name: 'My Event',
  queueLimit: 10,
  intervalSec: 60,
});

// Update event
await sdk.updateEvent('event-id', { queueLimit: 20 });

// Delete event
await sdk.deleteEvent('event-id');

// Get queue users
const users = await sdk.getQueueUsers('event-id');

// Start/stop queue
await sdk.startQueue('event-id');
await sdk.stopQueue('event-id');

// Advance queue manually
await sdk.advanceQueue('event-id');
```

## Error Handling

The SDK provides custom error classes for better error handling:

```typescript
import { SDKError, NetworkError, TimeoutError, ValidationError } from 'queue-sdk';

try {
  await sdk.joinQueue('event-id', 'user-id');
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation error:', error.message, error.details);
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
    console.error('Original error:', error.originalError);
  } else if (error instanceof TimeoutError) {
    console.error('Request timeout');
  } else if (error instanceof SDKError) {
    console.error('SDK error:', error.message);
    console.error('Status code:', error.statusCode);
    console.error('Error code:', error.code);
  }
}
```

## Request Cancellation

```typescript
const controller = new AbortController();

// Start request
const promise = sdk.getEvents({ signal: controller.signal });

// Cancel request
controller.abort();

try {
  await promise;
} catch (error) {
  if (error instanceof SDKError && error.code === 'ABORTED') {
    console.log('Request was cancelled');
  }
}
```

## Retry Logic

The SDK automatically retries failed requests with exponential backoff:

- **Default retries**: 3 attempts
- **Retry delay**: Starts at 1000ms, doubles with each retry
- **Retries on**: Network errors, 5xx server errors, timeouts
- **No retries on**: 4xx client errors (except 429 rate limit)

## Configuration

### Environment Variables

The SDK automatically detects the API URL from:

1. `window.__QUEUE_API_URL__` (browser global)
2. `import.meta.env.VITE_API_URL` (Vite)
3. `process.env.VITE_API_URL` (Node.js)
4. `/api` (default, relative path)

### Programmatic Configuration

```typescript
import { init, getBaseUrl, getConfig } from 'queue-sdk';

// Initialize
init({ baseUrl: 'https://api.example.com/api' });

// Get current base URL
const baseUrl = getBaseUrl();

// Get full configuration
const config = getConfig();
```

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import type {
  Event,
  QueueStatus,
  QueueUsers,
  JoinQueueResponse,
  InitOptions,
  RequestOptions,
  PollOptions,
  SDKError,
  NetworkError,
  TimeoutError,
  ValidationError,
} from 'queue-sdk';
```

## Best Practices

### 1. Error Handling

Always handle errors appropriately:

```typescript
try {
  const events = await sdk.getEvents();
} catch (error) {
  if (error instanceof SDKError) {
    // Handle SDK errors
    showUserFriendlyMessage(error.message);
  } else {
    // Handle unexpected errors
    logError(error);
  }
}
```

### 2. Request Cancellation

Cancel requests when components unmount:

```typescript
useEffect(() => {
  const controller = new AbortController();
  
  sdk.getEvents({ signal: controller.signal })
    .then(setEvents)
    .catch(handleError);
  
  return () => controller.abort();
}, []);
```

### 3. Polling

Always clean up polling:

```typescript
useEffect(() => {
  const cleanup = sdk.pollStatus(eventId, userId, onUpdate, {
    intervalMs: 2000,
    onError: handleError,
  });
  
  return cleanup;
}, [eventId, userId]);
```

## Examples

### React Hook Example

```typescript
import { useState, useEffect } from 'react';
import * as sdk from 'queue-sdk';
import type { Event } from 'queue-sdk';

function useEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    
    setLoading(true);
    sdk.getEvents({ signal: controller.signal })
      .then(setEvents)
      .catch(setError)
      .finally(() => setLoading(false));
    
    return () => controller.abort();
  }, []);

  return { events, loading, error };
}
```

### Queue Polling Example

```typescript
import * as sdk from 'queue-sdk';

const controller = new AbortController();

const cleanup = sdk.pollStatus(
  'event-id',
  'user-id',
  (status) => {
    if (status.state === 'active') {
      console.log('User is active!');
      cleanup(); // Stop polling when active
    }
  },
  {
    intervalMs: 2000,
    signal: controller.signal,
    onError: (error) => {
      console.error('Polling error:', error);
    },
  }
);

// Cancel polling
controller.abort();
```

## Using Across Multiple Projects

The SDK is designed to be used across multiple projects:

1. **Install as npm package**: `npm install queue-sdk` in each project
2. **Or use CDN**: Load from `https://your-api-domain.com/api/sdk`
3. **Set environment variable**: Set `VITE_API_URL` in each project's `.env` file
4. **Or use window global**: Set `window.__QUEUE_API_URL__` before importing

## Development

```bash
# Build the SDK
npm run build

# Lint
npm run lint

# Format
npm run format
```

## License

MIT
