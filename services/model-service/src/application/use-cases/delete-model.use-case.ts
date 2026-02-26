import { Injectable, NotFoundException } from '@nestjs/common';
import { ModelRepositoryInterface } from '../../domain/repositories/model.repository.interface';

@Injectable()
export class DeleteModelUseCase {
  constructor(private readonly modelRepository: ModelRepositoryInterface) {}

  async execute(id: string): Promise<void> {
    const model = await this.modelRepository.findById(id);
    if (!model) {
      throw new NotFoundException(`Model with id '${id}' not found`);
    }

    await this.modelRepository.delete(id);
  }
}
