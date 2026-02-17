import { Injectable, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ToolRepository } from '@domain/tool.repository.interface';
import { ToolEntity } from '@domain/tool.entity';

@Injectable()
export class GetToolUseCase {
  constructor(
    @Inject('ToolRepository')
    private readonly toolRepository: ToolRepository,
  ) {}

  async execute(id: string): Promise<ToolEntity> {
    const tool = await this.toolRepository.findById(id);
    if (!tool) {
      throw new NotFoundException(`Tool with ID "${id}" not found`);
    }
    return tool;
  }
}
