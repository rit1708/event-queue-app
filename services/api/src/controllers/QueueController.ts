import { Request, Response } from 'express';
import { QueueService } from '../services/QueueService';
import { asyncHandler } from '../errors/errorHandler';
import { BadRequestError } from '../errors/AppError';
import { JoinQueueDto, QueueStatusQuery } from '../types';
import { ApiResponse } from '../types';

export class QueueController {
  constructor(private queueService: QueueService) {}

  join = asyncHandler(async (req: Request, res: Response) => {
    const dto: JoinQueueDto = req.validated;
    const status = await this.queueService.joinQueue(dto);
    
    const response: ApiResponse = {
      success: true,
      data: {
        status: status.state,
        ...status,
      },
    };
    
    res.json(response.data);
  });

  getStatus = asyncHandler(async (req: Request, res: Response) => {
    const validated = req.validated || req.query;
    const { eventId, userId } = validated as QueueStatusQuery;
    
    if (!eventId || !userId) {
      throw new BadRequestError('eventId and userId are required');
    }
    
    const status = await this.queueService.getStatus(eventId, userId);
    
    const response: ApiResponse = {
      success: true,
      data: status,
    };
    
    res.json(response.data);
  });

  getQueueData = asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.query as { eventId: string };
    const data = await this.queueService.getQueueData(eventId);
    
    const response: ApiResponse = {
      success: true,
      data,
    };
    
    res.json(response.data);
  });

  advance = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validated;
    const data = await this.queueService.manuallyAdvanceQueue(id);
    
    const response: ApiResponse = {
      success: true,
      data: {
        ...data,
        active: data.active,
        waiting: data.waiting,
      },
    };
    
    res.json(response);
  });

  start = asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.body;
    await this.queueService.startQueue(eventId);
    
    const response: ApiResponse = {
      success: true,
      message: 'Queue started successfully',
    };
    
    res.json(response);
  });

  stop = asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.body;
    await this.queueService.stopQueue(eventId);
    
    const response: ApiResponse = {
      success: true,
      message: 'Queue stopped successfully',
    };
    
    res.json(response);
  });

  enqueueBatch = asyncHandler(async (req: Request, res: Response) => {
    const { eventId, count } = req.validated;
    const users = await this.queueService.enqueueBatchUsers(eventId, count);
    
    const response: ApiResponse = {
      success: true,
      data: {
        users,
      },
    };
    
    res.json(response);
  });

  getEntryHistory = asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.query as { eventId: string };
    const limit = parseInt(req.query.limit as string) || 200;
    const entries = await this.queueService.getEntryHistory(eventId, limit);
    
    const response: ApiResponse = {
      success: true,
      data: entries,
    };
    
    res.json(response.data);
  });
}

