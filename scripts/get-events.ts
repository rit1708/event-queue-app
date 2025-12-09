/**
 * Script to get events from database
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

async function getEvents() {
  const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/queue-app';
  const client = new MongoClient(mongoUrl);

  try {
    await client.connect();
    console.log('Connected to MongoDB\n');

    const db = client.db();
    const events = await db.collection('events').find({}).toArray();

    console.log(`Found ${events.length} events:\n`);
    
    if (events.length === 0) {
      console.log('No events found. Creating a sample event...');
      const result = await db.collection('events').insertOne({
        name: 'Test Event',
        domain: 'test.com',
        queueLimit: 5,
        intervalSec: 60,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('Created event with ID:', result.insertedId.toString());
      events.push({
        _id: result.insertedId,
        name: 'Test Event',
        domain: 'test.com',
        queueLimit: 5,
        intervalSec: 60,
        isActive: true,
      });
    }

    events.forEach((event: any, index: number) => {
      console.log(`Event ${index + 1}:`);
      console.log('  ID:', event._id.toString());
      console.log('  Name:', event.name);
      console.log('  Domain:', event.domain);
      console.log('  Queue Limit:', event.queueLimit);
      console.log('  Interval (sec):', event.intervalSec);
      console.log('  Is Active:', event.isActive);
      console.log('');
    });

    if (events.length > 0) {
      console.log('Use this event ID for testing:');
      console.log(events[0]._id.toString());
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

getEvents();

