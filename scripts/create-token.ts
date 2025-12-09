/**
 * Script to create a token in the database
 * Usage: npx ts-node scripts/create-token.ts <token> [name] [neverExpires]
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

interface TokenDocument {
  _id?: any;
  token: string;
  name?: string;
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  lastUsedAt?: Date;
}

async function createToken(token: string, name?: string, neverExpires: boolean = true) {
  const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/queue-app';
  const client = new MongoClient(mongoUrl);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const tokensCollection = db.collection<TokenDocument>('tokens');

    // Check if token already exists
    const existing = await tokensCollection.findOne({ token });
    if (existing) {
      console.log('Token already exists:', {
        _id: existing._id,
        name: existing.name,
        isActive: existing.isActive,
        expiresAt: existing.expiresAt || 'Never expires',
      });
      
      // Update to ensure it's active
      if (!existing.isActive) {
        await tokensCollection.updateOne(
          { token },
          { $set: { isActive: true } }
        );
        console.log('Token reactivated');
      }
      return;
    }

    // Create new token
    const now = new Date();
    const tokenDoc: TokenDocument = {
      token,
      name: name || `Token ${now.toISOString()}`,
      createdAt: now,
      expiresAt: neverExpires ? undefined : new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
      isActive: true,
    };

    const result = await tokensCollection.insertOne(tokenDoc);
    console.log('Token created successfully:', {
      _id: result.insertedId,
      name: tokenDoc.name,
      isActive: tokenDoc.isActive,
      expiresAt: tokenDoc.expiresAt || 'Never expires',
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
const name = args[1];
const neverExpires = args[2] !== 'false';

if (!token) {
  console.error('Usage: npx ts-node scripts/create-token.ts <token> [name] [neverExpires]');
  console.error('Example: npx ts-node scripts/create-token.ts "8f90005d15ba0dd885c5689590b39c88ba7a5055604c41b355bc894ae6783a50" "Client App Token"');
  process.exit(1);
}

createToken(token, name, neverExpires);



