# Queue SDK

A centralized SDK for the Queue Management System that can be used across multiple projects. The SDK automatically detects the API URL from environment variables or uses relative paths, making it easy to use in different environments.

## Features

- ✅ **Auto-detection**: Automatically detects API URL from environment variables or uses relative paths
- ✅ **Zero configuration**: Works out of the box without manual initialization
- ✅ **CDN ready**: Can be served as a CDN from the API server
- ✅ **NPM package**: Can be installed as an npm package
- ✅ **TypeScript support**: Full TypeScript definitions included

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

## Usage

### Basic Usage (Auto-detection)

The SDK will automatically detect the API URL from:
1. `window.__QUEUE_API_URL__` (if set in your app)
2. `import.meta.env.VITE_API_URL` (Vite environment variable)
3. `process.env.VITE_API_URL` (Node.js environment variable)
4. Relative path `/api` (default, assumes same origin)

```typescript
import * as sdk from 'queue-sdk';
import type { Event, QueueStatus } from 'queue-sdk';

// No initialization needed - SDK auto-detects API URL
const events = await sdk.getEvents();
```

### Manual Initialization (Optional)

If you need to set a custom API URL:

```typescript
import * as sdk from 'queue-sdk';

// Initialize with custom base URL
sdk.init({ baseUrl: 'https://api.example.com/api' });

// Or let it auto-detect
sdk.init(); // Uses auto-detection
```

### Setting API URL via Window Global

You can also set the API URL globally before importing the SDK:

```html
<script>
  window.__QUEUE_API_URL__ = 'https://api.example.com/api';
</script>
<script type="module">
  import * as sdk from 'queue-sdk';
  // SDK will use the window global
</script>
```

## API Methods

### Event Methods

- `getEvents()`: Fetch all events
- `getEvent(eventId)`: Get a specific event by ID

### Queue Methods

- `joinQueue(eventId, userId)`: Join a queue for an event
- `getQueueStatus(eventId, userId)`: Get queue status for a user
- `pollStatus(eventId, userId, onUpdate, intervalMs)`: Poll queue status at intervals

### Admin Methods

- `createDomain(name)`: Create a new domain
- `createEvent(params)`: Create a new event
- `updateEvent(eventId, updates)`: Update an event
- `deleteEvent(eventId)`: Delete an event
- `getQueueUsers(eventId)`: Get queue users for an event
- `updateQueueStatus(eventId, isActive)`: Update queue status
- `advanceQueue(eventId)`: Manually advance queue
- `startQueue(eventId)`: Start queue window
- `stopQueue(eventId)`: Stop queue window

## Examples

### Client Application

```typescript
import * as sdk from 'queue-sdk';
import type { Event } from 'queue-sdk';

// Fetch events
const events: Event[] = await sdk.getEvents();

// Join queue
const result = await sdk.joinQueue('event-id', 'user-id');

// Poll queue status
const cleanup = sdk.pollStatus('event-id', 'user-id', (status) => {
  console.log('Queue position:', status.position);
});
```

### Admin Application

```typescript
import * as sdk from 'queue-sdk';

// Create event
const event = await sdk.createEvent({
  domain: 'example.com',
  name: 'My Event',
  queueLimit: 10,
  intervalSec: 60
});

// Get queue users
const users = await sdk.getQueueUsers('event-id');
```

## Using Across Multiple Projects

The SDK is designed to be used across multiple projects. Simply:

1. **Install as npm package**: `npm install queue-sdk` in each project
2. **Or use CDN**: Load from `https://your-api-domain.com/api/sdk`
3. **Set environment variable**: Set `VITE_API_URL` in each project's `.env` file
4. **Or use window global**: Set `window.__QUEUE_API_URL__` before importing

The SDK will automatically use the correct API URL based on your environment, eliminating the need to hardcode URLs in multiple places.

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

