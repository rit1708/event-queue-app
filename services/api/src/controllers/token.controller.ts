import { Request, Response } from 'express';
import { getDb } from '../db/mongo';
import { ObjectId } from 'mongodb';
import * as crypto from 'crypto';
import { ValidationError, NotFoundError } from '../utils/errors';

interface TokenDocument {
  _id: ObjectId;
  token: string;
  name?: string;
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  lastUsedAt?: Date;
}

/**
 * Generate a secure random token
 */
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a new API token
 */
export async function generateToken(req: Request, res: Response): Promise<void> {
  const { name, expiresInDays, neverExpires } = req.body;
  const db = await getDb();

  // Generate token
  const token = generateSecureToken();
  const now = new Date();
  
  // Calculate expiration date
  let expiresAt: Date | undefined;
  if (!neverExpires) {
    const days = expiresInDays || 15; // Default to 15 days
    expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }

  const tokenDoc: Omit<TokenDocument, '_id'> = {
    token,
    name: name || `Token ${now.toISOString()}`,
    createdAt: now,
    expiresAt,
    isActive: true,
  };

  const result = await db.collection<TokenDocument>('tokens').insertOne(tokenDoc as TokenDocument);

  res.status(201).json({
    success: true,
    data: {
      _id: result.insertedId.toString(),
      token, // Only return token once on creation
      name: tokenDoc.name,
      createdAt: tokenDoc.createdAt,
      expiresAt: tokenDoc.expiresAt,
      isActive: tokenDoc.isActive,
    },
  });
}

/**
 * List all tokens (without exposing the actual token value)
 */
export async function listTokens(req: Request, res: Response): Promise<void> {
  const db = await getDb();
  const tokens = await db
    .collection<TokenDocument>('tokens')
    .find({})
    .project({ token: 0 }) // Don't return the actual token
    .sort({ createdAt: -1 })
    .toArray();

  // Check if tokens are expired
  const now = new Date();
  const tokensWithStatus = tokens.map((token) => {
    const isExpired = token.expiresAt ? new Date(token.expiresAt) < now : false;
    return {
      _id: token._id.toString(),
      name: token.name,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      isActive: token.isActive && !isExpired,
      isExpired,
      lastUsedAt: token.lastUsedAt,
    };
  });

  res.json({
    success: true,
    data: tokensWithStatus,
  });
}

/**
 * Revoke a token
 */
export async function revokeToken(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const db = await getDb();

  const result = await db
    .collection<TokenDocument>('tokens')
    .updateOne(
      { _id: new ObjectId(id) },
      { $set: { isActive: false } }
    );

  if (result.matchedCount === 0) {
    throw new NotFoundError('Token', id);
  }

  res.json({
    success: true,
    message: 'Token revoked successfully',
  });
}

/**
 * Delete a token
 */
export async function deleteToken(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const db = await getDb();

  const result = await db
    .collection<TokenDocument>('tokens')
    .deleteOne({ _id: new ObjectId(id) });

  if (result.deletedCount === 0) {
    throw new NotFoundError('Token', id);
  }

  res.json({
    success: true,
    message: 'Token deleted successfully',
  });
}

/**
 * Validate a token (used by middleware)
 */
export async function validateToken(token: string): Promise<boolean> {
  const db = await getDb();
  const now = new Date();

  const tokenDoc = await db.collection<TokenDocument>('tokens').findOne({
    token,
    isActive: true,
  });

  if (!tokenDoc) {
    return false;
  }

  // Check if token is expired
  if (tokenDoc.expiresAt && new Date(tokenDoc.expiresAt) < now) {
    // Mark as inactive
    await db
      .collection<TokenDocument>('tokens')
      .updateOne({ _id: tokenDoc._id }, { $set: { isActive: false } });
    return false;
  }

  // Update last used timestamp
  await db
    .collection<TokenDocument>('tokens')
    .updateOne({ _id: tokenDoc._id }, { $set: { lastUsedAt: now } });

  return true;
}

