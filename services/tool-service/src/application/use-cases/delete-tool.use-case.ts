import { Injectable, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ToolRepository } from '@domain/tool.repository.interface';

@Injectable()
export class DeleteToolUseCase {
  constructor(
    @Inject('ToolRepository')
    private readonly toolRepository: ToolRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const existingTool = await this.toolRepository.findById(id);
    if (!existingTool) {
      throw new NotFoundException(`Tool with ID "${id}" not found`);
    }

    if (existingTool.isBuiltIn) {
      throw new Error('Cannot delete built-in tools');
    }

    await this.toolRepository.delete(id);
  }
}
