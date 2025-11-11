import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;

  const uri = process.env.MONGO_URL;
  if (!uri) {
    throw new Error('❌ Missing MONGO_URL in environment variables');
  }

  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(); // Optional: pass db name like client.db('queueapp')
    console.log('✅ Connected to MongoDB Atlas via Railway');
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    throw error;
  }
}
