import { Injectable, ConflictException } from '@nestjs/common';
import { ModelRepositoryInterface } from '../../domain/repositories/model.repository.interface';
import { Model, CreateModelInput } from '../../domain/entities/model.entity';

@Injectable()
export class CreateModelUseCase {
  constructor(private readonly modelRepository: ModelRepositoryInterface) {}

  async execute(input: CreateModelInput): Promise<Model> {
    const existingModel = await this.modelRepository.findByName(input.name);
    if (existingModel) {
      throw new ConflictException(`Model with name '${input.name}' already exists`);
    }

    const model = await this.modelRepository.create(input);

    if (input.isDefault) {
      await this.modelRepository.setDefaultModel(model.id);
    }

    return model;
  }
}
