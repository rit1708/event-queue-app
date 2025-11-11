# Migration Guide

## Overview

The backend has been redesigned with a clean architecture following senior-level development practices. The old structure is kept for backward compatibility but should be migrated to the new structure.

## Old Structure (Deprecated)

```
src/
├── index.ts    # All logic in one file
├── mongo.ts    # MongoDB connection
└── queue.ts    # Queue operations
```

## New Structure

```
src/
├── config/          # Configuration
├── database/        # Database connections
├── repositories/    # Data access layer
├── services/        # Business logic
├── controllers/     # Request handlers
├── routes/          # Route definitions
├── middleware/      # Express middleware
├── validators/      # Validation schemas
├── errors/          # Error handling
├── types/           # TypeScript types
├── app.ts           # Application setup
└── index.ts         # Entry point
```

## Key Changes

### 1. Configuration Management

**Old**: Environment variables accessed directly
```typescript
const PORT = process.env.PORT || 4000;
```

**New**: Validated configuration
```typescript
import { env } from './config/env';
const PORT = env.PORT;
```

### 2. Error Handling

**Old**: Generic error handling
```typescript
catch (error) {
  res.status(500).json({ error: error.message });
}
```

**New**: Custom error classes
```typescript
throw new NotFoundError('Event not found');
// Automatically handled by errorHandler middleware
```

### 3. Logging

**Old**: console.log
```typescript
console.log('Error:', error);
```

**New**: Winston logger
```typescript
import logger from './config/logger';
logger.error('Error:', error);
```

### 4. Validation

**Old**: Manual validation
```typescript
if (!req.body.name) {
  return res.status(400).json({ error: 'Name required' });
}
```

**New**: Zod validation
```typescript
router.post('/event', validate(createEventSchema), eventController.create);
```

### 5. Database Operations

**Old**: Direct database calls
```typescript
const event = await db.collection('events').findOne({ _id: new ObjectId(id) });
```

**New**: Repository pattern
```typescript
const event = await eventRepository.findById(id);
```

### 6. Business Logic

**Old**: Logic in routes
```typescript
router.post('/event', async (req, res) => {
  // Business logic here
  const event = await db.collection('events').insertOne(req.body);
  // ...
});
```

**New**: Logic in services
```typescript
router.post('/event', validate(createEventSchema), eventController.create);
// Controller calls service
// Service calls repository
```

## Migration Steps

### Step 1: Update Dependencies

```bash
npm install winston
```

### Step 2: Update Environment Variables

Copy `.env.example` to `.env` and update:

```bash
cp .env.example .env
```

### Step 3: Update Imports

Update all imports to use the new structure:

```typescript
// Old
import { getDb } from './mongo';
import { getRedis } from './queue';

// New
import { getDb } from './database/mongo';
import { getRedis } from './database/redis';
```

### Step 4: Update Routes

Update routes to use new controllers:

```typescript
// Old
router.post('/event', async (req, res) => {
  // Logic here
});

// New
router.post('/event', validate(createEventSchema), eventController.create);
```

### Step 5: Update Error Handling

Update error handling to use custom error classes:

```typescript
// Old
if (!event) {
  return res.status(404).json({ error: 'Event not found' });
}

// New
if (!event) {
  throw new NotFoundError('Event not found');
}
```

### Step 6: Update Logging

Update logging to use Winston:

```typescript
// Old
console.log('Error:', error);

// New
import logger from './config/logger';
logger.error('Error:', error);
```

### Step 7: Remove Old Files

After migration is complete, remove old files:

```bash
rm src/mongo.ts
rm src/queue.ts
# Keep src/index.ts for now if it's still used
```

## Backward Compatibility

The old structure is kept for backward compatibility. The new structure is used by default, but old routes can still work if needed.

## Testing

After migration, test all endpoints:

```bash
npm run dev
# Test all endpoints
```

## Benefits of New Structure

1. **Maintainability**: Easy to understand and modify
2. **Testability**: Easy to test with mocked dependencies
3. **Scalability**: Easy to add new features
4. **Type Safety**: Full TypeScript coverage
5. **Error Handling**: Comprehensive error handling
6. **Logging**: Structured logging
7. **Validation**: Type-safe validation
8. **Best Practices**: Industry-standard practices

## Support

If you encounter any issues during migration, please refer to:
- `README.md`: General documentation
- `ARCHITECTURE.md`: Architecture overview
- Code comments: Inline documentation

## Conclusion

The new structure provides a solid foundation for future development and follows senior-level development practices. Migrate gradually and test thoroughly.

