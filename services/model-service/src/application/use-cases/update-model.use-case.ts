import { Injectable, NotFoundException } from '@nestjs/common';
import { ModelRepositoryInterface } from '../../domain/repositories/model.repository.interface';
import { Model, UpdateModelInput } from '../../domain/entities/model.entity';

@Injectable()
export class UpdateModelUseCase {
  constructor(private readonly modelRepository: ModelRepositoryInterface) {}

  async execute(id: string, input: UpdateModelInput): Promise<Model> {
    const existingModel = await this.modelRepository.findById(id);
    if (!existingModel) {
      throw new NotFoundException(`Model with id '${id}' not found`);
    }

    const updatedModel = await this.modelRepository.update(id, input);

    if (input.isDefault === true) {
      await this.modelRepository.setDefaultModel(id);
    }

    return updatedModel;
  }
}
