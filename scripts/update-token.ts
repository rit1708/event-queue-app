/**
 * Script to update a token in the database (e.g., make it never expire)
 * Usage: npx ts-node scripts/update-token.ts <token> [neverExpires]
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

async function updateToken(token: string, neverExpires: boolean = true) {
  const mongoUrl = process.env.MONGODB_URI || process.env.MONGO_LOCAL_URL || 'mongodb://127.0.0.1:27017/queue-app';
  const client = new MongoClient(mongoUrl);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const tokensCollection = db.collection('tokens');

    // Check if token exists
    const existing = await tokensCollection.findOne({ token });
    if (!existing) {
      console.error('Token not found in database');
      process.exit(1);
    }

    console.log('Current token status:', {
      _id: existing._id,
      name: existing.name,
      isActive: existing.isActive,
      expiresAt: existing.expiresAt || 'Never expires',
    });

    // Update token
    if (neverExpires) {
      // Remove expiration date
      await tokensCollection.updateOne(
        { token },
        { $set: { isActive: true }, $unset: { expiresAt: '' } }
      );
    } else {
      // Keep expiration date but ensure active
      await tokensCollection.updateOne(
        { token },
        { $set: { isActive: true } }
      );
    }

    console.log('Token updated successfully:', {
      isActive: true,
      expiresAt: neverExpires ? 'Never expires' : existing.expiresAt,
    });
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Get arguments from command line
const args = process.argv.slice(2);
const token = args[0];
const neverExpires = args[1] !== 'false';

if (!token) {
  console.error('Usage: npx ts-node scripts/update-token.ts <token> [neverExpires]');
  console.error('Example: npx ts-node scripts/update-token.ts "8f90005d15ba0dd885c5689590b39c88ba7a5055604c41b355bc894ae6783a50" true');
  process.exit(1);
}

updateToken(token, neverExpires);

