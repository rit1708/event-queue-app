import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo';
import { NotFoundError, ConflictError } from '../utils/errors';
import { Event } from '../types';

export const getEvents = async (req: Request, res: Response): Promise<void> => {
  const db = await getDb();
  const events = await db.collection('events').find({}).toArray();

  const formattedEvents: Event[] = events.map((e: any) => ({
    _id: String(e._id),
    name: e.name,
    domain: e.domain,
    queueLimit: e.queueLimit,
    intervalSec: e.intervalSec,
    isActive: e.isActive || false,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }));

  res.json(formattedEvents);
};

export const getEvent = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const db = await getDb();
  const event = await db
    .collection('events')
    .findOne({ _id: new ObjectId(id) });

  if (!event) {
    throw new NotFoundError('Event', id);
  }

  res.json({
    _id: String(event._id),
    name: event.name,
    domain: event.domain,
    queueLimit: event.queueLimit,
    intervalSec: event.intervalSec,
    isActive: event.isActive || false,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  });
};

export const createEvent = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { domain, name, queueLimit, intervalSec } = req.body;
  const db = await getDb();

  // Check if domain exists
  const domainDoc = await db.collection('domains').findOne({ name: domain });
  if (!domainDoc) {
    throw new NotFoundError('Domain', domain);
  }

  // Check for duplicate event name in domain
  const existing = await db.collection('events').findOne({ domain, name });
  if (existing) {
    throw new ConflictError(
      `Event with name '${name}' already exists in domain '${domain}'`
    );
  }

  const event = {
    domain,
    name,
    queueLimit,
    intervalSec,
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const { insertedId } = await db.collection('events').insertOne(event);
  res.status(201).json({
    _id: String(insertedId),
    ...event,
  });
};

export const updateEvent = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const updates = req.body;
  const db = await getDb();

  const updateData = {
    ...updates,
    updatedAt: new Date(),
  };

  const updateResult = await db
    .collection('events')
    .updateOne({ _id: new ObjectId(id) }, { $set: updateData });

  if (updateResult.matchedCount === 0) {
    throw new NotFoundError('Event', id);
  }

  res.json({ success: true });
};

export const deleteEvent = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const db = await getDb();

  const deleteResult = await db
    .collection('events')
    .deleteOne({ _id: new ObjectId(id) });

  if (deleteResult.deletedCount === 0) {
    throw new NotFoundError('Event', id);
  }

  res.json({ success: true });
};
