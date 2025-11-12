import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;

  const uri = 'mongodb+srv://ritesh_db_user:penB8JnBHMkrvIWz@cluster0.ubjm6lh.mongodb.net/?appName=Cluster0';
  const dbName = process.env.MONGO_DB || undefined;
  if (!uri) {
    throw new Error('❌ Missing MONGO_URL in environment variables');
  }

  try {
    client = new MongoClient(uri);
    await client.connect();
    db = dbName ? client.db(dbName) : client.db();
    console.log(`✅ Connected to MongoDB${dbName ? ` (db: ${dbName})` : ''}`);
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    throw error;
  }
}
