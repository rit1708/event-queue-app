import { Request, Response } from 'express';
import { EventService } from '../services/EventService';
import { asyncHandler } from '../errors/errorHandler';
import { CreateEventDto, UpdateEventDto } from '../types';
import { ApiResponse } from '../types';

export class EventController {
  constructor(private eventService: EventService) {}

  getAll = asyncHandler(async (req: Request, res: Response) => {
    const events = await this.eventService.getAllEvents();
    
    const response: ApiResponse = {
      success: true,
      data: events.map((e) => ({
        _id: e._id.toString(),
        name: e.name,
        domain: e.domain,
        queueLimit: e.queueLimit,
        intervalSec: e.intervalSec,
        isActive: e.isActive || false,
        createdAt: e.createdAt,
      })),
    };
    
    res.json(response.data);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validated;
    const event = await this.eventService.getEventById(id);
    
    const response: ApiResponse = {
      success: true,
      data: {
        _id: event._id.toString(),
        name: event.name,
        domain: event.domain,
        queueLimit: event.queueLimit,
        intervalSec: event.intervalSec,
        isActive: event.isActive || false,
        createdAt: event.createdAt,
      },
    };
    
    res.json(response.data);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const dto: CreateEventDto = req.validated;
    const event = await this.eventService.createEvent(dto);
    
    const response: ApiResponse = {
      success: true,
      data: {
        eventId: event._id.toString(),
        ...event,
        _id: event._id.toString(),
      },
    };
    
    res.status(201).json(response.data);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validated;
    const dto: UpdateEventDto = req.body;
    const event = await this.eventService.updateEvent(id, dto);
    
    const response: ApiResponse = {
      success: true,
      data: {
        _id: event._id.toString(),
        ...event,
      },
    };
    
    res.json(response);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validated;
    await this.eventService.deleteEvent(id);
    
    const response: ApiResponse = {
      success: true,
      message: 'Event deleted successfully',
    };
    
    res.json(response);
  });

}

