import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/queueapp';
  client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  return db;
}



