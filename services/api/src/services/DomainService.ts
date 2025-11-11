import { DomainRepository } from '../repositories/DomainRepository';
import { CreateDomainDto, Domain } from '../types';
import { NotFoundError } from '../errors/AppError';

export class DomainService {
  constructor(private domainRepository: DomainRepository) {}

  async getAllDomains(): Promise<Domain[]> {
    return await this.domainRepository.findAll();
  }

  async getDomainById(id: string): Promise<Domain> {
    const domain = await this.domainRepository.findById(id);
    if (!domain) {
      throw new NotFoundError('Domain not found');
    }
    return domain;
  }

  async createDomain(dto: CreateDomainDto): Promise<Domain> {
    return await this.domainRepository.create(dto);
  }

  async deleteDomain(id: string): Promise<void> {
    await this.domainRepository.delete(id);
  }
}

