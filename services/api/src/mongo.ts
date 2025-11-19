import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;

  const uri =
    process.env.MONGO_URL ||
    'mongodb+srv://ritesh_db_user:penB8JnBHMkrvIWz@cluster0.ubjm6lh.mongodb.net/?appName=Cluster0';
  if (!uri) {
    throw new Error('❌ Missing MONGO_URL in environment variables');
  }

  try {
    client = new MongoClient(uri);
    await client.connect();
    console.log(`✅ Connected to MongoDB`);
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    throw error;
  }
}
