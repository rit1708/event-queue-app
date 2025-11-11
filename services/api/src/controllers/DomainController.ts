import { Request, Response } from 'express';
import { DomainService } from '../services/DomainService';
import { asyncHandler } from '../errors/errorHandler';
import { CreateDomainDto } from '../types';
import { ApiResponse } from '../types';

export class DomainController {
  constructor(private domainService: DomainService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const dto: CreateDomainDto = req.validated;
    const domain = await this.domainService.createDomain(dto);
    
    const response: ApiResponse = {
      success: true,
      data: {
        domainId: domain._id.toString(),
        name: domain.name,
      },
    };
    
    res.status(201).json(response);
  });

  getAll = asyncHandler(async (req: Request, res: Response) => {
    const domains = await this.domainService.getAllDomains();
    
    const response: ApiResponse = {
      success: true,
      data: domains.map((d) => ({
        domainId: d._id.toString(),
        name: d.name,
        createdAt: d.createdAt,
      })),
    };
    
    res.json(response);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validated;
    const domain = await this.domainService.getDomainById(id);
    
    const response: ApiResponse = {
      success: true,
      data: {
        domainId: domain._id.toString(),
        name: domain.name,
        createdAt: domain.createdAt,
      },
    };
    
    res.json(response);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validated;
    await this.domainService.deleteDomain(id);
    
    const response: ApiResponse = {
      success: true,
      message: 'Domain deleted successfully',
    };
    
    res.json(response);
  });
}

