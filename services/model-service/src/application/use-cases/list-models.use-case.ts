import { Injectable } from '@nestjs/common';
import {
  ModelRepositoryInterface,
  ModelFilters,
  PaginatedModels,
} from '../../domain/repositories/model.repository.interface';
import { Model, ModelProvider } from '../../domain/entities/model.entity';

@Injectable()
export class ListModelsUseCase {
  constructor(private readonly modelRepository: ModelRepositoryInterface) {}

  async execute(filters?: ModelFilters): Promise<PaginatedModels> {
    return this.modelRepository.findAll(filters);
  }

  async getByProvider(provider: ModelProvider): Promise<Model[]> {
    return this.modelRepository.findByProvider(provider);
  }
}
