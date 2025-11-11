# API 404 Error Fix

## Problem

The frontend apps (client and admin) were getting 404 errors and `ERR_CONNECTION_REFUSED` errors when trying to call API endpoints.

## Root Cause

The error handling middleware (404 handler) was being set up in the constructor **before** routes were registered. This meant:

1. Constructor runs → sets up 404 handler
2. Initialize runs → sets up routes
3. But 404 handler catches all requests before routes can handle them

## Solution

Moved the error handling setup to **after** routes are registered in the `initialize()` method.

### Before (Broken)
```typescript
constructor() {
  this.app = express();
  this.setupMiddleware();
  this.setupErrorHandling(); // ❌ Too early - catches all routes
}

async initialize() {
  await this.setupRoutes(); // Routes registered after 404 handler
}
```

### After (Fixed)
```typescript
constructor() {
  this.app = express();
  this.setupMiddleware();
  // Error handling will be set up after routes are registered
}

async initialize() {
  await this.setupRoutes();
  this.setupErrorHandling(); // ✅ After routes - 404 only for unmatched routes
}
```

## Express Middleware Order

In Express, middleware order matters! The order should be:

1. **CORS & Body Parsers** (first)
2. **Request Logging** (early)
3. **Rate Limiting** (before routes)
4. **Routes** (actual endpoints)
5. **404 Handler** (catch unmatched routes)
6. **Error Handler** (catch errors)

## Verification

After the fix, all endpoints are working:

```bash
# Events endpoint
curl http://localhost:4000/api/events
# ✅ Returns array of events

# Queue status endpoint
curl "http://localhost:4000/api/queue/status?eventId=...&userId=..."
# ✅ Returns queue status

# Health check
curl http://localhost:4000/health
# ✅ Returns health status
```

## Frontend Configuration

Both frontend apps are correctly configured:

- **Client App**: `VITE_API_URL || 'http://localhost:4000/api'`
- **Admin App**: `VITE_API_URL || 'http://localhost:4000/api'`

## Testing

To verify everything works:

1. **Start the backend**:
   ```bash
   npm run dev:local
   ```

2. **Test API endpoints**:
   ```bash
   curl http://localhost:4000/api/events
   curl http://localhost:4000/health
   ```

3. **Test frontend apps**:
   - Open client app: http://localhost:5173
   - Open admin app: http://localhost:5174
   - Check browser console for any errors
   - Verify API calls are successful

## Status

✅ **FIXED** - All API endpoints are now accessible and working correctly.

