import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;

  const uri =
    'mongodb+srv://ritesh_db_user:penB8JnBHMkrvIWz@cluster0.ubjm6lh.mongodb.net/?appName=Cluster0';
  if (!uri) {
    throw new Error('Missing MONGO_URI in environment variables');
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(); // You can also specify db name explicitly if needed
  console.log('✅ Connected to MongoDB Atlas');
  return db;
}
