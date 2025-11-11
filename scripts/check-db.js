const { MongoClient } = require('mongodb');

async function checkDatabase() {
  const uri = process.env.MONGO_URL || 'mongodb://localhost:27017/queueapp';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();

    // Check events collection
    const events = await db.collection('events').find({}).toArray();
    console.log('Events in database:', events);

    // If no events, create a sample event
    if (events.length === 0) {
      console.log('No events found. Creating a sample event...');
      const result = await db.collection('events').insertOne({
        name: 'Sample Event',
        domain: 'sample',
        queueLimit: 10,
        intervalSec: 30,
        isActive: true,
        createdAt: new Date(),
      });
      console.log('Created sample event with ID:', result.insertedId);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkDatabase();
