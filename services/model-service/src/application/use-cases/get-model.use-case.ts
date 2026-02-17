import { Injectable, NotFoundException } from '@nestjs/common';
import { ModelRepositoryInterface } from '../../domain/repositories/model.repository.interface';
import { Model } from '../../domain/entities/model.entity';

@Injectable()
export class GetModelUseCase {
  constructor(private readonly modelRepository: ModelRepositoryInterface) {}

  async execute(id: string): Promise<Model> {
    const model = await this.modelRepository.findById(id);
    if (!model) {
      throw new NotFoundException(`Model with id '${id}' not found`);
    }
    return model;
  }

  async getByName(name: string): Promise<Model> {
    const model = await this.modelRepository.findByName(name);
    if (!model) {
      throw new NotFoundException(`Model with name '${name}' not found`);
    }
    return model;
  }

  async getDefault(): Promise<Model> {
    const model = await this.modelRepository.getDefaultModel();
    if (!model) {
      throw new NotFoundException('No default model configured');
    }
    return model;
  }
}
