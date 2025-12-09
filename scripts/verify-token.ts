/**
 * Script to verify a token exists in the database and check its status
 * Usage: npx ts-node scripts/verify-token.ts <token>
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

async function verifyToken(token: string) {
  const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/queue-app';
  const client = new MongoClient(mongoUrl);

  try {
    await client.connect();
    console.log('Connected to MongoDB\n');

    const db = client.db();
    const tokensCollection = db.collection('tokens');

    const trimmedToken = token.trim();
    console.log('Looking for token:', trimmedToken.substring(0, 20) + '...');
    console.log('Token length:', trimmedToken.length);
    console.log('');

    // Check exact match
    const exactMatch = await tokensCollection.findOne({ token: trimmedToken });
    
    // Check all tokens to see if there's a similar one
    const allTokens = await tokensCollection.find({}).toArray();
    
    console.log('=== Token Verification Results ===\n');
    
    if (exactMatch) {
      console.log('✅ Token FOUND in database');
      console.log('Token ID:', exactMatch._id);
      console.log('Name:', exactMatch.name || 'N/A');
      console.log('Is Active:', exactMatch.isActive);
      console.log('Created At:', exactMatch.createdAt);
      console.log('Expires At:', exactMatch.expiresAt || 'Never expires');
      console.log('Last Used At:', exactMatch.lastUsedAt || 'Never used');
      
      const now = new Date();
      if (exactMatch.expiresAt && new Date(exactMatch.expiresAt) < now) {
        console.log('⚠️  WARNING: Token is EXPIRED');
      } else if (!exactMatch.isActive) {
        console.log('⚠️  WARNING: Token is INACTIVE');
      } else {
        console.log('✅ Token is VALID and ACTIVE');
      }
    } else {
      console.log('❌ Token NOT FOUND in database');
      console.log('\nAvailable tokens in database:');
      allTokens.forEach((t, i) => {
        console.log(`\nToken ${i + 1}:`);
        console.log('  ID:', t._id);
        console.log('  Name:', t.name || 'N/A');
        console.log('  Is Active:', t.isActive);
        console.log('  Token (first 20 chars):', t.token?.substring(0, 20) + '...');
        console.log('  Token length:', t.token?.length || 0);
      });
    }
    
    console.log('\n=== Token Comparison ===');
    console.log('Expected token length:', trimmedToken.length);
    console.log('Expected token (first 20):', trimmedToken.substring(0, 20));
    if (allTokens.length > 0) {
      const firstToken = allTokens[0];
      console.log('First token in DB length:', firstToken.token?.length || 0);
      console.log('First token in DB (first 20):', firstToken.token?.substring(0, 20) || 'N/A');
      
      // Check if tokens match character by character
      if (firstToken.token && firstToken.token.length === trimmedToken.length) {
        let matches = 0;
        for (let i = 0; i < Math.min(trimmedToken.length, firstToken.token.length); i++) {
          if (trimmedToken[i] === firstToken.token[i]) matches++;
        }
        console.log(`Character match: ${matches}/${trimmedToken.length} characters match`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Get token from command line
const args = process.argv.slice(2);
const token = args[0];

if (!token) {
  console.error('Usage: npx ts-node scripts/verify-token.ts <token>');
  console.error('Example: npx ts-node scripts/verify-token.ts "861b3114a2da21ad2019b98b732489f37dbb785bc180b113f5c96961cff4efa4"');
  process.exit(1);
}

verifyToken(token);

