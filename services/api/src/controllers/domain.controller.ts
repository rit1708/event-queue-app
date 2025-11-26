import { Request, Response } from 'express';
import { getDb } from '../db/mongo';
import { ConflictError } from '../utils/errors';

export const createDomain = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { name } = req.body;
  const db = await getDb();

  const existing = await db.collection('domains').findOne({ name });
  if (existing) {
    throw new ConflictError(`Domain '${name}' already exists`);
  }

  const { insertedId } = await db
    .collection('domains')
    .insertOne({ name, createdAt: new Date() });

  res.status(201).json({
    domainId: String(insertedId),
    name,
  });
};

export const getDomains = async (
  req: Request,
  res: Response
): Promise<void> => {
  const db = await getDb();
  const domains = await db.collection('domains').find({}).toArray();

  res.json(
    domains.map((d: any) => ({
      _id: String(d._id),
      name: d.name,
      createdAt: d.createdAt,
    }))
  );
};

