import { MongoClient, Db } from 'mongodb';
import { env } from '../config/env';
import logger from '../config/logger';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) {
    return db;
  }

  try {
    client = new MongoClient(env.MONGO_URI);
    await client.connect();
    db = client.db();
    
    logger.info('✅ MongoDB connected successfully', {
      database: db.databaseName,
      uri: env.MONGO_URI.replace(/\/\/.*@/, '//***:***@'), // Hide credentials in logs
    });

    // Set up connection event handlers
    client.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
    });

    client.on('close', () => {
      logger.warn('MongoDB connection closed');
      db = null;
    });

    return db;
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

export async function disconnectMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info('MongoDB disconnected');
  }
}

export async function getDb(): Promise<Db> {
  if (!db) {
    return await connectMongo();
  }
  return db;
}

export function isConnected(): boolean {
  return client !== null && db !== null;
}

