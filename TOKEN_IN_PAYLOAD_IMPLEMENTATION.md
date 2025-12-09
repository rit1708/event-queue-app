# Token in Payload Implementation

## Summary

The join queue API now accepts the token in the **request payload** instead of the Authorization header. The client SDK automatically sends the token in the payload when calling `joinQueue()`.

## Changes Made

### 1. API Schema Update
**File**: `services/api/src/schemas/event.schema.ts`
- Added `token` field to `joinQueueSchema` body (optional for backward compatibility)

### 2. New Middleware
**File**: `services/api/src/middleware/tokenAuthPayload.ts`
- Created `tokenAuthPayload` middleware that validates token from `req.body.token`
- Logs token validation steps for debugging

### 3. Route Update
**File**: `services/api/src/routes/queue.routes.ts`
- Changed `/queue/join` route to use `tokenAuthPayload` instead of `tokenAuth`
- `/queue/status` still uses `tokenAuth` (header-based) for consistency

### 4. SDK Update
**File**: `packages/sdk/src/queue.ts`
- `joinQueue()` function now:
  - Gets token from SDK config
  - Includes token in request body payload
  - Explicitly excludes Authorization header
  - Throws error if token is not configured

**File**: `packages/sdk/src/http.ts`
- Updated to handle explicit exclusion of Authorization header
- When `Authorization: null` is set in headers, it won't add the header

### 5. Client App
**File**: `apps/client/src/App.tsx`
- No changes needed - client app already sets token via `sdk.setToken()`
- SDK automatically handles sending token in payload

## How It Works

### Request Flow

1. **Client App** → Sets token: `sdk.setToken('861b3114...')`
2. **SDK joinQueue()** → Gets token from config
3. **SDK HTTP** → Sends POST request with:
   - Body: `{ eventId, userId, domain?, token }`
   - Headers: `Content-Type: application/json` (NO Authorization header)
4. **API Middleware** → `tokenAuthPayload` extracts token from `req.body.token`
5. **Token Validation** → Validates token in database
6. **Queue Controller** → Processes join request

### Example Request

```json
POST /api/queue/join
Content-Type: application/json

{
  "eventId": "691db29d360f8b835418a182",
  "userId": "test-user-123",
  "domain": "demo.com",
  "token": "861b3114a2da21ad2019b98b732489f37dbb785bc180b113f5c96961cff4efa4"
}
```

### Response

**Success (200)**:
```json
{
  "success": true,
  "status": "active",
  "state": "active",
  "position": 0,
  "total": 1,
  "timeRemaining": 0,
  "activeUsers": 1,
  "waitingUsers": 0,
  "showWaitingTimer": false
}
```

**Error - No Token (401)**:
```json
{
  "success": false,
  "error": "Token is required in request body",
  "code": "UNAUTHORIZED"
}
```

**Error - Invalid Token (401)**:
```json
{
  "success": false,
  "error": "Invalid or expired token",
  "code": "UNAUTHORIZED"
}
```

## Testing

### Test Script
```bash
npx ts-node scripts/test-join-queue.ts <eventId> <userId>
```

### Manual Test with curl
```bash
curl -X POST http://localhost:4000/api/queue/join \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "691db29d360f8b835418a182",
    "userId": "test-user",
    "domain": "demo.com",
    "token": "861b3114a2da21ad2019b98b732489f37dbb785bc180b113f5c96961cff4efa4"
  }'
```

## Benefits

1. **Simpler for Client Apps**: Token can be passed directly in the request body
2. **No Header Manipulation**: No need to set Authorization header
3. **Backward Compatible**: Token in header still works for `/queue/status` endpoint
4. **Clear Separation**: Join queue uses payload, status uses header

## Notes

- The `/queue/status` endpoint still uses token in Authorization header
- Token is required in payload for `/queue/join` endpoint
- SDK automatically handles token inclusion in payload
- Client app doesn't need any changes - just ensure token is set via `sdk.setToken()`

## Verification

✅ Token authentication working (tested - gets past 401 errors)
✅ Token sent in payload (verified in test script)
✅ SDK automatically includes token (no client changes needed)
✅ API validates token from payload (middleware working)

