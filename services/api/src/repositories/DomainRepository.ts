import { Db, ObjectId } from 'mongodb';
import { Domain, CreateDomainDto } from '../types';
import { ConflictError, NotFoundError } from '../errors/AppError';
import logger from '../config/logger';

export class DomainRepository {
  constructor(private db: Db) {}

  async findAll(): Promise<Domain[]> {
    try {
      const domains = await this.db.collection<Domain>('domains').find({}).toArray();
      return domains;
    } catch (error) {
      logger.error('Failed to find domains:', error);
      throw error;
    }
  }

  async findByName(name: string): Promise<Domain | null> {
    try {
      const domain = await this.db.collection<Domain>('domains').findOne({ name });
      return domain;
    } catch (error) {
      logger.error('Failed to find domain by name:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Domain | null> {
    try {
      const domain = await this.db
        .collection<Domain>('domains')
        .findOne({ _id: new ObjectId(id) });
      return domain;
    } catch (error) {
      logger.error('Failed to find domain by id:', error);
      throw error;
    }
  }

  async create(dto: CreateDomainDto): Promise<Domain> {
    try {
      // Check if domain already exists
      const existing = await this.findByName(dto.name);
      if (existing) {
        throw new ConflictError(`Domain "${dto.name}" already exists`);
      }

      const domain: Omit<Domain, '_id'> = {
        name: dto.name,
        createdAt: new Date(),
      };

      const result = await this.db.collection<Domain>('domains').insertOne(domain as any);
      
      const created = await this.findById(result.insertedId.toString());
      if (!created) {
        throw new Error('Failed to retrieve created domain');
      }

      logger.info('Domain created', { domainId: result.insertedId.toString(), name: dto.name });
      return created;
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      logger.error('Failed to create domain:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .collection<Domain>('domains')
        .deleteOne({ _id: new ObjectId(id) });
      
      if (result.deletedCount === 0) {
        throw new NotFoundError('Domain not found');
      }

      logger.info('Domain deleted', { domainId: id });
      return true;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to delete domain:', error);
      throw error;
    }
  }
}

