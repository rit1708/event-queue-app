import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/mongo';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
} from '../utils/errors';

type DomainDoc = {
  _id: string;
  name: string;
  createdAt?: Date;
};

declare module 'express-serve-static-core' {
  interface Locals {
    domain?: DomainDoc;
    domainName?: string;
  }
}

const extractDomainName = (req: Request): string | null => {
  const candidates = [
    req.body?.domain,
    req.body?.name,
    req.params?.domain,
    req.params?.domainName,
    req.query?.domain,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
};

export const ensureDomainExists = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const domainName = extractDomainName(req);
    if (!domainName) {
      throw new ValidationError('Domain name is required');
    }

    const db = await getDb();
    const domainDoc = await db.collection('domains').findOne({ name: domainName });

    if (!domainDoc) {
      throw new NotFoundError('Domain', domainName);
    }

    res.locals.domain = {
      _id: String(domainDoc._id),
      name: domainDoc.name,
      createdAt: domainDoc.createdAt,
    };
    res.locals.domainName = domainDoc.name;

    next();
  } catch (error) {
    next(error);
  }
};

export const ensureDomainAvailable = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const domainName = extractDomainName(req);
    if (!domainName) {
      throw new ValidationError('Domain name is required');
    }

    const db = await getDb();
    const existing = await db.collection('domains').findOne({ name: domainName });

    if (existing) {
      throw new ConflictError(`Domain '${domainName}' already exists`);
    }

    res.locals.domainName = domainName;
    next();
  } catch (error) {
    next(error);
  }
};

