# Queue Management API

A production-ready Node.js/Express API for queue management with clean architecture principles.

## Architecture

This API follows a **layered architecture** pattern with clear separation of concerns:

```
src/
├── config/          # Configuration (env, logger)
├── database/        # Database connections (MongoDB, Redis)
├── repositories/    # Data access layer
├── services/        # Business logic layer
├── controllers/     # Request handlers
├── routes/          # Route definitions
├── middleware/      # Express middleware
├── validators/      # Request validation schemas
├── errors/          # Error handling
├── types/           # TypeScript type definitions
└── app.ts           # Application setup
└── index.ts         # Entry point
```

## Features

- ✅ **Clean Architecture**: Separation of concerns with repositories, services, and controllers
- ✅ **Type Safety**: Full TypeScript support with proper types
- ✅ **Error Handling**: Custom error classes with proper error handling middleware
- ✅ **Validation**: Request validation using Zod schemas
- ✅ **Logging**: Winston logger with different log levels
- ✅ **Configuration**: Environment-based configuration with validation
- ✅ **Rate Limiting**: Built-in rate limiting middleware
- ✅ **Health Checks**: Health and readiness endpoints
- ✅ **Database Management**: Proper MongoDB and Redis connection handling
- ✅ **Scheduler**: Background job scheduler for queue advancement

## Setup

### Prerequisites

- Node.js 20+
- MongoDB
- Redis

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## API Endpoints

### Public Endpoints

- `GET /api/v1/events` - List all events
- `GET /api/v1/events/:id` - Get event by ID
- `POST /api/v1/queue/join` - Join queue
- `GET /api/v1/queue/status` - Get queue status

### Admin Endpoints

- `POST /api/v1/admin/domain` - Create domain
- `GET /api/v1/admin/domains` - List all domains
- `POST /api/v1/admin/event` - Create event
- `PUT /api/v1/admin/event/:id` - Update event
- `DELETE /api/v1/admin/event/:id` - Delete event
- `POST /api/v1/admin/event/start` - Start queue
- `POST /api/v1/admin/event/stop` - Stop queue
- `POST /api/v1/admin/event/:id/advance` - Manually advance queue
- `GET /api/v1/admin/event/users` - Get queue users
- `POST /api/v1/admin/event/enqueue-batch` - Enqueue batch users

### Health Checks

- `GET /health` - Health check endpoint
- `GET /ready` - Readiness check endpoint

## Project Structure

### Configuration (`config/`)

- `env.ts`: Environment variable validation and configuration
- `logger.ts`: Winston logger configuration

### Database (`database/`)

- `mongo.ts`: MongoDB connection and management
- `redis.ts`: Redis connection and management
- `queue.ts`: Queue operations (enqueue, advance, status)

### Repositories (`repositories/`)

Data access layer that abstracts database operations:

- `DomainRepository.ts`: Domain CRUD operations
- `EventRepository.ts`: Event CRUD operations
- `EntryRepository.ts`: Queue entry operations

### Services (`services/`)

Business logic layer:

- `DomainService.ts`: Domain business logic
- `EventService.ts`: Event business logic
- `QueueService.ts`: Queue management logic
- `SchedulerService.ts`: Background queue scheduler

### Controllers (`controllers/`)

Request handlers that process HTTP requests:

- `DomainController.ts`: Domain endpoints
- `EventController.ts`: Event endpoints
- `QueueController.ts`: Queue endpoints

### Middleware (`middleware/`)

- `logger.middleware.ts`: Request logging
- `rateLimiter.middleware.ts`: Rate limiting
- `healthCheck.middleware.ts`: Health check endpoints

### Validators (`validators/`)

Zod schemas for request validation:

- Request body validation
- Query parameter validation
- Route parameter validation

### Errors (`errors/`)

- `AppError.ts`: Base error classes
- `errorHandler.ts`: Error handling middleware

## Best Practices

1. **Error Handling**: Use custom error classes for different error types
2. **Validation**: Always validate input using Zod schemas
3. **Logging**: Use structured logging with appropriate log levels
4. **Type Safety**: Use TypeScript types throughout the application
5. **Async/Await**: Use async/await for asynchronous operations
6. **Database**: Use repositories for all database operations
7. **Business Logic**: Keep business logic in services, not controllers
8. **Configuration**: Use environment variables for configuration

## Testing

```bash
npm test
```

## Logging

Logs are written to:
- `logs/error.log`: Error logs
- `logs/combined.log`: All logs

Log levels: `error`, `warn`, `info`, `debug`

## Rate Limiting

Default rate limit: 100 requests per 15 minutes per IP address.

## Database Migrations

Currently, the application uses MongoDB without migrations. For production, consider using a migration tool like `migrate-mongo`.

## Monitoring

- Health check: `GET /health`
- Readiness check: `GET /ready`

## Security

- Rate limiting enabled
- CORS configured
- Input validation on all endpoints
- Error messages sanitized in production

## Performance

- Connection pooling for MongoDB
- Redis connection reuse
- Efficient queue operations
- Background scheduler for queue advancement

## Contributing

1. Follow the existing code structure
2. Use TypeScript types
3. Add tests for new features
4. Update documentation
5. Follow ESLint rules

