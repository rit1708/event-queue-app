# Token Debugging Guide

## ✅ Token Status
- **Token**: `861b3114a2da21ad2019b98b732489f37dbb785bc180b113f5c96961cff4efa4`
- **Database Status**: ✅ Found, Active, Never expires
- **Token Length**: 64 characters

## How Token is Sent

### Client Side (SDK)
The token is sent in the **Authorization header**, NOT in the payload:

```typescript
// Location: packages/sdk/src/http.ts (line 62-64)
headers['Authorization'] = `Bearer ${cfg.token}`;
```

### Server Side (API)
The API expects the token in the **Authorization header**:

```typescript
// Location: services/api/src/middleware/tokenAuth.ts
const authHeader = req.headers.authorization;
// Extracts: "Bearer <token>" or just "<token>"
```

## Request Flow

1. **Client App** → Sets token via `sdk.setToken('861b3114...')`
2. **SDK** → Adds to headers: `Authorization: Bearer 861b3114...`
3. **API Middleware** → Extracts token from header
4. **Token Controller** → Validates token in database
5. **Response** → Returns success or error

## Debugging Steps

### 1. Check Browser Console
Open DevTools (F12) → Console tab, run:
```javascript
// Check if token is set in SDK
import * as sdk from 'queue-sdk';
console.log('SDK Token:', sdk.getToken());

// Check localStorage
console.log('localStorage Token:', localStorage.getItem('queue_api_token'));
```

### 2. Check Network Requests
1. Open DevTools (F12) → Network tab
2. Try to join a queue
3. Find the request to `/api/queue/join` or `/api/queue/status`
4. Click on the request → Headers tab
5. Look for `Authorization` header:
   - ✅ Should be: `Bearer 861b3114a2da21ad2019b98b732489f37dbb785bc180b113f5c96961cff4efa4`
   - ❌ If missing or different, that's the issue

### 3. Check Server Logs
The API now logs token validation. Check your server console for:
```
[tokenAuth] Validating token: 861b3114...
[validateToken] Looking for token: 861b3114...
[validateToken] Token is valid
```

If you see:
```
[tokenAuth] No Authorization header found
```
→ Token is not being sent from client

If you see:
```
[validateToken] Token not found or not active in database
```
→ Token mismatch or database issue

### 4. Verify Token in Database
```bash
npx ts-node scripts/verify-token.ts "861b3114a2da21ad2019b98b732489f37dbb785bc180b113f5c96961cff4efa4"
```

### 5. Clear and Reset Token
In browser console:
```javascript
// Clear old token
localStorage.removeItem('queue_api_token');

// Set new token
localStorage.setItem('queue_api_token', '861b3114a2da21ad2019b98b732489f37dbb785bc180b113f5c96961cff4efa4');

// Reload page
location.reload();
```

## Common Issues

### Issue 1: Token Not Sent
**Symptom**: `Authorization token required` error
**Cause**: Token not set in SDK
**Fix**: 
```javascript
import * as sdk from 'queue-sdk';
sdk.setToken('861b3114a2da21ad2019b98b732489f37dbb785bc180b113f5c96961cff4efa4');
```

### Issue 2: Token Mismatch
**Symptom**: `Invalid or expired token` error
**Cause**: Token in localStorage doesn't match database
**Fix**: Clear localStorage and reload

### Issue 3: Token Format Issue
**Symptom**: Token validation fails
**Cause**: Extra whitespace or characters
**Fix**: Token is automatically trimmed, but check for hidden characters

## Enable SDK Logging

To see what the SDK is doing, enable logging:

```javascript
import * as sdk from 'queue-sdk';
sdk.init({ enableLogging: true });
```

This will log all requests and show if the Authorization header is being added.

## Test Token Directly

You can test the token with curl:

```bash
curl -X POST http://localhost:4000/api/queue/join \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 861b3114a2da21ad2019b98b732489f37dbb785bc180b113f5c96961cff4efa4" \
  -d '{"eventId":"your-event-id","userId":"test-user"}'
```

If this works, the token is valid and the issue is in the client app.
If this fails, check the server logs for the validation error.

