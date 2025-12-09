/**
 * Script to ensure a domain exists in the database
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

async function ensureDomain(domainName: string) {
  const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/queue-app';
  const client = new MongoClient(mongoUrl);

  try {
    await client.connect();
    console.log('Connected to MongoDB\n');

    const db = client.db();
    const domainsCollection = db.collection('domains');

    const existing = await domainsCollection.findOne({ name: domainName });
    
    if (existing) {
      console.log(`✅ Domain "${domainName}" already exists`);
      console.log('Domain ID:', existing._id);
    } else {
      console.log(`Creating domain "${domainName}"...`);
      const result = await domainsCollection.insertOne({
        name: domainName,
        createdAt: new Date(),
      });
      console.log(`✅ Domain created with ID: ${result.insertedId}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

const domain = process.argv[2] || 'demo.com';
ensureDomain(domain);

