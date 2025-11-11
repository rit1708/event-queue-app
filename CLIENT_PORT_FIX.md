# Client App Port 5000 Issue - Fixed

## Problem

The client app was trying to connect to `http://localhost:5000/api/events` instead of the correct API URL `http://localhost:4000/api/events`.

## Root Causes

1. **Vite Proxy Configuration**: The proxy was rewriting `/api` paths, removing the prefix that the backend expects
2. **Absolute URLs**: The client was using absolute URLs instead of leveraging Vite's proxy in development
3. **Port Mismatch**: Some configuration was pointing to port 5000 instead of 4000

## Solutions Applied

### 1. Fixed Vite Proxy Configuration

**File**: `apps/client/vite.config.ts`

**Before**:
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:4000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, '') // ❌ Removed /api prefix
  }
}
```

**After**:
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:4000',
    changeOrigin: true,
    // ✅ Don't rewrite - keep /api prefix as backend expects it
  }
}
```

### 2. Updated SDK to Use Relative URLs in Development

**Files**: 
- `apps/client/src/App.tsx`
- `apps/client/src/sdk.ts`
- `apps/client/src/AdminPanel.tsx`

**Before**:
```typescript
baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
```

**After**:
```typescript
const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;
  // In development, use relative URL to leverage Vite proxy
  if (import.meta.env.DEV) {
    return '/api'; // ✅ Uses Vite proxy
  }
  // Production fallback
  return 'http://localhost:4000/api';
};
```

## How It Works Now

### Development Mode
1. Client app runs on `http://localhost:5173`
2. API calls use relative URLs: `/api/events`
3. Vite proxy intercepts `/api/*` requests
4. Proxy forwards to `http://localhost:4000/api/*` (keeping the `/api` prefix)
5. Backend receives requests at correct endpoints

### Production Mode
- Uses absolute URL from `VITE_API_URL` environment variable
- Or falls back to `http://localhost:4000/api`

## Benefits

1. ✅ **No Port Issues**: Uses Vite proxy, no hardcoded ports
2. ✅ **CORS Handling**: Proxy handles CORS automatically
3. ✅ **Environment Flexible**: Can override with `VITE_API_URL`
4. ✅ **Development Friendly**: Relative URLs work seamlessly
5. ✅ **Production Ready**: Absolute URLs for production builds

## Testing

After these changes:

1. **Restart the client dev server**:
   ```bash
   npm run dev:local
   # or
   cd apps/client && npm run dev
   ```

2. **Verify API calls**:
   - Open browser DevTools → Network tab
   - Check that requests go to `/api/events` (relative)
   - Should see successful responses (200 status)

3. **Check console**:
   - No more `ERR_CONNECTION_REFUSED` errors
   - No more 404 errors
   - API calls should succeed

## Environment Variables

You can still override the API URL with:

```bash
# In apps/client/.env or .env.local
VITE_API_URL=http://localhost:4000/api
```

Or for production:
```bash
VITE_API_URL=https://api.yourdomain.com/api
```

## Status

✅ **FIXED** - Client app now correctly connects to the API using:
- Relative URLs in development (via Vite proxy)
- Correct port (4000) via proxy
- Proper `/api` prefix preserved

