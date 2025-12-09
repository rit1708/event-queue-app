/**
 * Script to test the join queue API with the token
 * Usage: npx ts-node scripts/test-join-queue.ts [eventId] [userId]
 */

import * as dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.API_URL || 'http://localhost:4000';
const TOKEN = '861b3114a2da21ad2019b98b732489f37dbb785bc180b113f5c96961cff4efa4';

async function testJoinQueue(eventId?: string, userId?: string) {
  const testEventId = eventId || 'test-event-' + Date.now();
  const testUserId = userId || 'test-user-' + Math.random().toString(36).slice(2, 10);

  console.log('=== Testing Join Queue API ===\n');
  console.log('API Base URL:', API_BASE_URL);
  console.log('Token:', TOKEN.substring(0, 20) + '...');
  console.log('Event ID:', testEventId);
  console.log('User ID:', testUserId);
  console.log('');

  try {
    // First, get event details to get the domain
    console.log('0. Getting event details...');
    const eventResponse = await fetch(`${API_BASE_URL}/api/events/${testEventId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
      },
    });
    
    let eventDomain = 'demo.com'; // default
    if (eventResponse.ok) {
      const eventData = await eventResponse.json() as any;
      eventDomain = eventData.domain || 'demo.com';
      console.log('Event domain:', eventDomain);
    } else {
      console.log('Could not fetch event, using default domain:', eventDomain);
    }
    console.log('');

    // Test 1: Join Queue (with token in payload)
    console.log('1. Testing POST /api/queue/join (token in payload)');
    const joinResponse = await fetch(`${API_BASE_URL}/api/queue/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // NO Authorization header - token is in payload
      },
      body: JSON.stringify({
        eventId: testEventId,
        userId: testUserId,
        domain: eventDomain, // Include domain
        token: TOKEN, // Token in payload
      }),
    });

    console.log('Status:', joinResponse.status, joinResponse.statusText);
    const joinData = await joinResponse.json();
    console.log('Response:', JSON.stringify(joinData, null, 2));
    console.log('');

    if (!joinResponse.ok) {
      console.error('❌ Join Queue failed!');
      return;
    }

    console.log('✅ Join Queue successful!\n');

    // Test 2: Get Queue Status
    console.log('2. Testing GET /api/queue/status');
    const statusResponse = await fetch(
      `${API_BASE_URL}/api/queue/status?eventId=${encodeURIComponent(testEventId)}&userId=${encodeURIComponent(testUserId)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
        },
      }
    );

    console.log('Status:', statusResponse.status, statusResponse.statusText);
    const statusData = await statusResponse.json();
    console.log('Response:', JSON.stringify(statusData, null, 2));
    console.log('');

    if (!statusResponse.ok) {
      console.error('❌ Get Queue Status failed!');
      return;
    }

    console.log('✅ Get Queue Status successful!\n');

    // Test 3: Test without token (should fail)
    console.log('3. Testing without token (should fail)');
    const noTokenResponse = await fetch(`${API_BASE_URL}/api/queue/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No Authorization header
      },
      body: JSON.stringify({
        eventId: testEventId,
        userId: testUserId + '-no-token',
      }),
    });

    console.log('Status:', noTokenResponse.status, noTokenResponse.statusText);
    const noTokenData = await noTokenResponse.json().catch(() => ({ error: 'No JSON response' }));
    console.log('Response:', JSON.stringify(noTokenData, null, 2));

    if (noTokenResponse.status === 401) {
      console.log('✅ Correctly rejected request without token\n');
    } else {
      console.log('⚠️  Unexpected response for request without token\n');
    }

    // Test 4: Test with invalid token (should fail)
    console.log('4. Testing with invalid token (should fail)');
    const invalidTokenResponse = await fetch(`${API_BASE_URL}/api/queue/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token-12345',
      },
      body: JSON.stringify({
        eventId: testEventId,
        userId: testUserId + '-invalid-token',
      }),
    });

    console.log('Status:', invalidTokenResponse.status, invalidTokenResponse.statusText);
    const invalidTokenData = await invalidTokenResponse.json().catch(() => ({ error: 'No JSON response' }));
    console.log('Response:', JSON.stringify(invalidTokenData, null, 2));

    if (invalidTokenResponse.status === 401) {
      console.log('✅ Correctly rejected request with invalid token\n');
    } else {
      console.log('⚠️  Unexpected response for request with invalid token\n');
    }

    console.log('=== All Tests Complete ===');

  } catch (error) {
    console.error('❌ Error testing API:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Get arguments from command line
const args = process.argv.slice(2);
const eventId = args[0];
const userId = args[1];

testJoinQueue(eventId, userId);

