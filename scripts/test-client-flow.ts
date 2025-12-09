/**
 * Test script to simulate client app flow with token in payload
 */

import * as dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.API_URL || 'http://localhost:4000';
const TOKEN = '861b3114a2da21ad2019b98b732489f37dbb785bc180b113f5c96961cff4efa4';

async function testClientFlow() {
  console.log('=== Testing Client App Flow ===\n');
  console.log('Simulating: Client app sets token, then calls joinQueue()\n');

  // Simulate what client app does
  // 1. Set token (like App.tsx does)
  console.log('1. Setting token (simulating sdk.setToken())');
  console.log('   Token:', TOKEN.substring(0, 20) + '...\n');

  // 2. Get event (simulate getting event from API)
  console.log('2. Getting event list...');
  const eventsResponse = await fetch(`${API_BASE_URL}/api/events`);
  const events = await eventsResponse.json() as any[];
  
  if (!events || events.length === 0) {
    console.error('❌ No events found. Please create an event first.');
    return;
  }

  const event = events[0] as any;
  console.log(`   Found event: ${event.name} (ID: ${event._id})`);
  console.log(`   Domain: ${event.domain}\n`);

  // 3. Simulate joinQueue call (what SDK does)
  console.log('3. Calling joinQueue (simulating SDK joinQueue())');
  const userId = 'test-user-' + Math.random().toString(36).slice(2, 10);
  console.log('   User ID:', userId);
  console.log('   Event ID:', event._id);
  console.log('   Domain:', event.domain);
  console.log('   Token in payload: YES\n');

  const joinResponse = await fetch(`${API_BASE_URL}/api/queue/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // NO Authorization header - token is in payload
    },
    body: JSON.stringify({
      eventId: event._id,
      userId: userId,
      domain: event.domain,
      token: TOKEN, // Token in payload (what SDK should send)
    }),
  });

  console.log('4. Join Queue Response:');
  console.log('   Status:', joinResponse.status, joinResponse.statusText);
  
  const joinData = await joinResponse.json() as any;
  console.log('   Response:', JSON.stringify(joinData, null, 2));
  console.log('');

  if (joinResponse.ok) {
    console.log('✅ Join Queue successful!');
    console.log('   State:', joinData.state);
    console.log('   Position:', joinData.position);
    console.log('   Total:', joinData.total);
  } else {
    console.log('❌ Join Queue failed!');
    if (joinResponse.status === 401) {
      console.log('   Error: Token authentication failed');
      console.log('   This means token was not validated correctly');
    } else if (joinResponse.status === 503) {
      console.log('   Error: Redis not available (but token auth passed!)');
    }
  }

  // 5. Test getQueueStatus (still uses header)
  console.log('\n5. Testing getQueueStatus (uses Authorization header)');
  const statusResponse = await fetch(
    `${API_BASE_URL}/api/queue/status?eventId=${encodeURIComponent(event._id)}&userId=${encodeURIComponent(userId)}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`, // Status still uses header
      },
    }
  );

  console.log('   Status:', statusResponse.status, statusResponse.statusText);
  const statusData = await statusResponse.json().catch(() => ({}));
  console.log('   Response:', JSON.stringify(statusData, null, 2));
}

testClientFlow().catch(console.error);

