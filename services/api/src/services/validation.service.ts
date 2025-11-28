import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo';
import { NotFoundError, ValidationError } from '../utils/errors';

export interface ValidationResult {
  isValid: boolean;
  domain?: {
    _id: string;
    name: string;
    createdAt?: Date;
  };
  event?: {
    _id: string;
    name: string;
    domain: string;
    queueLimit: number;
    intervalSec: number;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  };
  error?: string;
  errorCode?: string;
}

/**
 * Validates domain and event existence and relationship
 * @param domainName - The domain name to validate
 * @param eventId - The event ID to validate
 * @returns Validation result with domain and event data if valid
 */
export async function validateDomainAndEvent(
  domainName: string | null | undefined,
  eventId: string | null | undefined
): Promise<ValidationResult> {
  // Validate inputs
  if (!domainName || typeof domainName !== 'string' || domainName.trim().length === 0) {
    return {
      isValid: false,
      error: 'Domain not validated',
      errorCode: 'DOMAIN_REQUIRED',
    };
  }

  if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
    return {
      isValid: false,
      error: 'Event ID is required',
      errorCode: 'EVENT_ID_REQUIRED',
    };
  }

  // Validate event ID format
  if (!ObjectId.isValid(eventId)) {
    return {
      isValid: false,
      error: 'Invalid event ID format',
      errorCode: 'INVALID_EVENT_ID',
    };
  }

  const db = await getDb();

  // Validate domain exists
  const domainDoc = await db.collection('domains').findOne({ name: domainName.trim() });
  if (!domainDoc) {
    return {
      isValid: false,
      error: 'Domain not validated',
      errorCode: 'DOMAIN_NOT_FOUND',
    };
  }

  // Validate event exists
  const eventDoc = await db
    .collection('events')
    .findOne({ _id: new ObjectId(eventId) });
  
  if (!eventDoc) {
    return {
      isValid: false,
      error: 'Event not exist',
      errorCode: 'EVENT_NOT_FOUND',
    };
  }

  // Validate event belongs to domain
  if (eventDoc.domain !== domainName.trim()) {
    return {
      isValid: false,
      error: 'Event does not belong to the specified domain',
      errorCode: 'EVENT_DOMAIN_MISMATCH',
    };
  }

  // Return valid result with data
  return {
    isValid: true,
    domain: {
      _id: String(domainDoc._id),
      name: domainDoc.name,
      createdAt: domainDoc.createdAt,
    },
    event: {
      _id: String(eventDoc._id),
      name: eventDoc.name,
      domain: eventDoc.domain,
      queueLimit: eventDoc.queueLimit,
      intervalSec: eventDoc.intervalSec,
      isActive: eventDoc.isActive || false,
      createdAt: eventDoc.createdAt,
      updatedAt: eventDoc.updatedAt,
    },
  };
}

/**
 * Validates domain and event from request
 * Extracts domain and eventId from request body or query
 * If domain is not provided, it will be fetched from the event
 */
export async function validateDomainAndEventFromRequest(
  req: { body?: any; query?: any }
): Promise<ValidationResult> {
  let domainName = req.body?.domain || req.query?.domain || null;
  const eventId = req.body?.eventId || req.query?.eventId || null;

  // If domain is not provided but eventId is, fetch domain from event
  if (!domainName && eventId && ObjectId.isValid(eventId)) {
    try {
      const db = await getDb();
      const eventDoc = await db
        .collection('events')
        .findOne({ _id: new ObjectId(eventId) });
      
      if (eventDoc && eventDoc.domain) {
        domainName = eventDoc.domain;
      }
    } catch (error) {
      // Will be handled by validateDomainAndEvent
    }
  }

  return validateDomainAndEvent(domainName, eventId);
}

