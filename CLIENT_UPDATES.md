# Client & Admin App Updates

## Overview

Both the client and admin apps have been updated to work with the new backend architecture. The changes include improved error handling, response parsing, and API endpoint compatibility.

## Changes Made

### 1. Client App (`apps/client/`)

#### SDK Updates (`src/sdk.ts`)
- ✅ Added `handleResponse` helper function for consistent response parsing
- ✅ Handles both wrapped (`{success, data}`) and direct response formats
- ✅ Improved error handling with proper error message extraction
- ✅ Updated to use correct API base URL (`http://localhost:4000/api`)
- ✅ Added support for new error response format from backend

#### App.tsx Updates
- ✅ Updated SDK implementation with improved error handling
- ✅ Fixed `joinQueue` to handle new `QueueStatus` response format
- ✅ Updated API URL to use environment variable with fallback
- ✅ Fixed response parsing to handle backend's direct data responses
- ✅ Updated `pollStatus` to correctly handle timeRemaining (seconds to ms conversion)

#### AdminPanel.tsx Updates
- ✅ Added SDK initialization with correct API URL
- ✅ Uses updated SDK functions

### 2. Admin App (`apps/admin/`)

#### App.tsx Updates
- ✅ Added `handleApiResponse` helper function for consistent response parsing
- ✅ Updated all API calls to use the new helper function
- ✅ Improved error handling with proper error message extraction
- ✅ Updated API URL to use environment variable with fallback
- ✅ Fixed response parsing for all endpoints:
  - `loadEvents()` - Now handles direct array response
  - `loadQueueData()` - Handles QueueData response
  - `startQueue()` - Handles success response
  - `stopQueue()` - Handles success response
  - `handleCreateEvent()` - Handles event creation response
  - `handleUpdateEvent()` - Handles update response
  - `handleDeleteEvent()` - Handles delete response

## API Response Format

The backend now returns responses in two formats:

### Direct Data (Most Endpoints)
```json
[Event1, Event2, ...]
```
or
```json
{
  "_id": "...",
  "name": "...",
  ...
}
```

### Wrapped Response (Some Endpoints)
```json
{
  "success": true,
  "data": {...},
  "message": "..."
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

The client apps now handle both formats automatically.

## Environment Variables

Both apps now use:
```bash
VITE_API_URL=http://localhost:4000/api
```

Default fallback: `http://localhost:4000/api`

## Updated Endpoints

All endpoints remain the same, but response handling is improved:

### Public Endpoints
- `GET /api/events` - Returns array of events directly
- `GET /api/events/:id` - Returns event object directly
- `POST /api/queue/join` - Returns QueueStatus directly
- `GET /api/queue/status` - Returns QueueStatus directly

### Admin Endpoints
- `POST /api/admin/domain` - Returns wrapped response
- `POST /api/admin/event` - Returns event data directly
- `PUT /api/admin/event/:id` - Returns wrapped response
- `DELETE /api/admin/event/:id` - Returns wrapped response
- `POST /api/admin/event/start` - Returns wrapped response
- `POST /api/admin/event/stop` - Returns wrapped response
- `GET /api/admin/event/users` - Returns QueueData directly

## Error Handling

### Before
```typescript
if (!response.ok) {
  const error = await response.text();
  throw new Error(error || 'Failed');
}
```

### After
```typescript
async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = 'Request failed';
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');
    
    if (isJson) {
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        errorMessage = await response.text() || errorMessage;
      }
    } else {
      errorMessage = await response.text() || errorMessage;
    }
    
    throw new Error(errorMessage);
  }
  
  // Parse response...
}
```

## Benefits

1. **Consistent Error Handling**: All API calls use the same error handling logic
2. **Better Error Messages**: Extracts meaningful error messages from backend responses
3. **Type Safety**: Proper TypeScript types for all responses
4. **Flexible Response Parsing**: Handles both wrapped and direct responses
5. **Environment Configuration**: Uses environment variables for API URLs
6. **Backward Compatible**: Works with both old and new backend response formats

## Testing

After these updates, test the following:

1. **Client App**:
   - ✅ Browse events
   - ✅ Join queue
   - ✅ View queue status
   - ✅ Create domain/event

2. **Admin App**:
   - ✅ View dashboard
   - ✅ Create/update/delete events
   - ✅ Start/stop queues
   - ✅ View queue users
   - ✅ View analytics

## Migration Notes

- All existing functionality is preserved
- No breaking changes to UI/UX
- Only internal API communication is updated
- Error messages are now more descriptive
- Response parsing is more robust

## Next Steps

1. Test all functionality in both apps
2. Verify error handling works correctly
3. Check that environment variables are set correctly
4. Monitor for any API compatibility issues

