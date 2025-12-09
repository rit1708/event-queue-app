# Troubleshooting Token Issues

## Token: `861b3114a2da21ad2019b98b732489f37dbb785bc180b113f5c96961cff4efa4`

### Status
✅ Token has been added to the database
✅ Token is set to never expire
✅ Token is active

### Common Issues and Solutions

#### 1. Clear Browser localStorage
The app caches tokens in localStorage. Clear it:

**In Browser Console:**
```javascript
localStorage.removeItem('queue_api_token');
location.reload();
```

#### 2. Verify Token in Database
Check if token exists and is active:
```bash
npx ts-node scripts/update-token.ts "861b3114a2da21ad2019b98b732489f37dbb785bc180b113f5c96961cff4efa4" true
```

#### 3. Check Token Format
The token should be sent as:
```
Authorization: Bearer 861b3114a2da21ad2019b98b732489f37dbb785bc180b113f5c96961cff4efa4
```

#### 4. Verify SDK Token Setting
In browser console, check:
```javascript
// Check if token is set
import * as sdk from 'queue-sdk';
console.log('Token:', sdk.getToken());

// Manually set token
sdk.setToken('861b3114a2da21ad2019b98b732489f37dbb785bc180b113f5c96961cff4efa4');
```

#### 5. Check Network Requests
Open browser DevTools → Network tab → Check Authorization header in requests:
- Should be: `Bearer 861b3114a2da21ad2019b98b732489f37dbb785bc180b113f5c96961cff4efa4`
- Should NOT have extra spaces or characters

#### 6. Restart the Application
After updating the token:
1. Clear browser cache
2. Clear localStorage
3. Restart the dev server
4. Reload the page

### Quick Fix Script
Run this in browser console to reset token:
```javascript
localStorage.setItem('queue_api_token', '861b3114a2da21ad2019b98b732489f37dbb785bc180b113f5c96961cff4efa4');
location.reload();
```

