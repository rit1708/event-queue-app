import express, { Express } from 'express';
import cors from 'cors';
import { env } from './config/env';
import logger from './config/logger';
import { errorHandler } from './errors/errorHandler';
import { requestLogger } from './middleware/logger.middleware';
import { rateLimiter } from './middleware/rateLimiter.middleware';
import { healthCheck, readinessCheck } from './middleware/healthCheck.middleware';
import { connectMongo, getDb } from './database/mongo';
import { connectRedis, getRedis } from './database/redis';
import Redis from 'ioredis';
import { DomainRepository } from './repositories/DomainRepository';
import { EventRepository } from './repositories/EventRepository';
import { EntryRepository } from './repositories/EntryRepository';
import { DomainService } from './services/DomainService';
import { EventService } from './services/EventService';
import { QueueService } from './services/QueueService';
import { SchedulerService } from './services/SchedulerService';
import { DomainController } from './controllers/DomainController';
import { EventController } from './controllers/EventController';
import { QueueController } from './controllers/QueueController';
import { createRoutes } from './routes';

export class App {
  private app: Express;
  private schedulerService: SchedulerService | null = null;
  private domainRepository: DomainRepository | null = null;
  private eventRepository: EventRepository | null = null;
  private entryRepository: EntryRepository | null = null;
  private redisClient: Redis | null = null;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    // Error handling will be set up after routes are registered
  }

  private setupMiddleware(): void {
    // CORS
    this.app.use(
      cors({
        origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        credentials: true,
      })
    );

    // Body parser
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use(requestLogger);

    // Rate limiting
    this.app.use(rateLimiter);

    // Health checks (before rate limiting for monitoring)
    this.app.get('/health', healthCheck);
    this.app.get('/ready', readinessCheck);
    
    // Root route
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Queue Management API',
        version: env.API_VERSION,
        status: 'running',
        environment: env.NODE_ENV,
      });
    });
  }

  private async setupRoutes(): Promise<void> {
    if (!this.domainRepository || !this.eventRepository || !this.entryRepository || !this.redisClient) {
      throw new Error('Dependencies not initialized');
    }

    // Services
    const domainService = new DomainService(this.domainRepository);
    const eventService = new EventService(this.eventRepository);
    const queueService = new QueueService(eventService, this.entryRepository, this.redisClient);

    // Controllers
    const domainController = new DomainController(domainService);
    const eventController = new EventController(eventService);
    const queueController = new QueueController(queueService);

    // Initialize scheduler
    this.schedulerService = new SchedulerService(eventService);

    // Routes
    this.app.use(`/api/${env.API_VERSION}`, createRoutes(domainController, eventController, queueController));
    // Legacy routes for backward compatibility
    this.app.use('/api', createRoutes(domainController, eventController, queueController));
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
      });
    });

    // Error handler
    this.app.use(errorHandler);
  }

  async initialize(): Promise<void> {
    try {
      // Connect to databases
      await connectMongo();
      await connectRedis();

      // Get database and Redis clients
      const db = await getDb();
      this.redisClient = await getRedis();

      // Initialize repositories after database connections
      this.domainRepository = new DomainRepository(db);
      this.eventRepository = new EventRepository(db);
      this.entryRepository = new EntryRepository(db);

      // Setup routes after repositories are initialized
      await this.setupRoutes();

      // Setup error handling AFTER routes (404 handler must be last)
      this.setupErrorHandling();

      // Start scheduler
      if (this.schedulerService) {
        this.schedulerService.start();
      }

      logger.info('Application initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down application...');

      // Stop scheduler
      if (this.schedulerService) {
        this.schedulerService.stop();
      }

      logger.info('Application shutdown complete');
    } catch (error) {
      logger.error('Error during shutdown:', error);
      throw error;
    }
  }

  getApp(): Express {
    return this.app;
  }
}
