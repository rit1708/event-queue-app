import { ObjectId } from 'mongodb';

export interface Domain {
  _id: ObjectId;
  name: string;
  createdAt: Date;
}

export interface Event {
  _id: ObjectId;
  domain: string;
  name: string;
  queueLimit: number;
  intervalSec: number;
  isActive?: boolean;
  createdAt: Date;
}

export interface QueueEntry {
  _id: ObjectId;
  eventId: string;
  userId: string;
  enteredAt: Date;
}

export interface QueueStatus {
  state: 'waiting' | 'active' | 'not_queued';
  position: number;
  total: number;
  timeRemaining: number;
  activeUsers: number;
  waitingUsers: number;
}

export interface QueueData {
  active: string[];
  waiting: string[];
  remaining: number;
}

export interface CreateDomainDto {
  name: string;
}

export interface CreateEventDto {
  domain: string;
  name: string;
  queueLimit: number;
  intervalSec: number;
}

export interface UpdateEventDto {
  queueLimit?: number;
  intervalSec?: number;
  isActive?: boolean;
}

export interface JoinQueueDto {
  eventId: string;
  userId: string;
}

export interface QueueStatusQuery {
  eventId: string;
  userId: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

