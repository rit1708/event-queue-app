# Backend Logging Guide

The API service now includes a production-ready logging system with configurable log levels and file management.

## Features

- JSON structured logs (timestamp, level, message, metadata)
- Console output + file persistence
- Separate `combined.log` and `error.log`
- Configurable log level via environment variable
- Automatic log directory creation

## Configuration

| Variable   | Description                              | Default                         |
|------------|------------------------------------------|---------------------------------|
| `LOG_LEVEL`| Minimum level to log (`debug/info/warn/error`) | `debug` in development, `info` otherwise |
| `LOG_DIR`  | Directory for log files                  | `services/api/logs`             |

Example `.env`:

```env
LOG_LEVEL=warn
LOG_DIR=/var/log/queue-api
```

## Log Files

- `combined.log`: All log entries (info, warn, error, debug*)
- `error.log`: Only warnings and errors

> \* Debug logs are only written when `NODE_ENV=development` or when `LOG_LEVEL=debug`.

## Usage

```ts
import { logger } from '../utils/logger';

logger.info('Server started', { port: 4000 });
logger.warn('Redis connection slow', { attempt: 2 });
logger.error('Failed to enqueue user', error, { eventId, userId });
```

## Log Rotation

Logs are appended to the configured files. Use external tools (e.g., `logrotate`, `pm2`, or container log drivers) to rotate/compress logs in production.

