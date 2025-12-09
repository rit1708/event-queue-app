import { MongoClient, Db, MongoClientOptions } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;
let connectionAttempts = 0;
let lastConnectionError: Error | null = null;
let currentUri: string | null = null;

export async function getDb(): Promise<Db> {
  // If we have a connection, return it (MongoDB driver handles reconnection automatically)
  if (db && client) {
    return db;
  }
5
  const candidates = [
    process.env.MONGO_LOCAL_URL,
    'mongodb://127.0.0.1:27017/queue-app',
    process.env.MONGO_URL,
  ].filter((value): value is string => Boolean(value));

  if (candidates.length === 0) {
    throw new Error('No MongoDB connection string provided');
  }

  let lastError: Error | null = null;

  for (const uri of candidates) {
    try {
      connectionAttempts++;

      const isSrv = uri.startsWith('mongodb+srv://');
      const isLocal =
        uri.includes('127.0.0.1') ||
        uri.includes('localhost') ||
        uri.includes('0.0.0.0');
      const allowInsecure = process.env.MONGO_TLS_INSECURE === 'true';

      const options: MongoClientOptions = {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        maxPoolSize: 10,
        minPoolSize: 1,
      };

      if (allowInsecure) {
        options.tlsAllowInvalidCertificates = true;
      }

      if (!isSrv && isLocal) {
        options.directConnection = true;
        options.tls = false;
      }

      client = new MongoClient(uri, options);
      await client.connect();
      db = client.db();
      currentUri = uri;
      console.log(`✅ Connected to MongoDB (${isSrv ? 'Atlas' : 'local'})`);
      connectionAttempts = 0;
      lastConnectionError = null;
      return db;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      lastConnectionError = lastError;
      console.error('❌ MongoDB connection failed:', lastError.message);
      if (client) {
        try {
          await client.close();
        } catch {
          // ignore
        }
        client = null;
      }
      db = null;
      continue;
    }
  }

  throw (
    lastError ||
    new Error('Failed to connect to MongoDB using provided connection strings')
  );
}

export function isDbConnected(): boolean {
  return db !== null && client !== null;
}

export function getCurrentMongoUri(): string | null {
  return currentUri;
}
