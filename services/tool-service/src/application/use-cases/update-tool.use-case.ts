import { Injectable, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ToolRepository } from '@domain/tool.repository.interface';
import { ToolEntity } from '@domain/tool.entity';
import { UpdateToolDto } from '@application/dto/update-tool.dto';

@Injectable()
export class UpdateToolUseCase {
  constructor(
    @Inject('ToolRepository')
    private readonly toolRepository: ToolRepository,
  ) {}

  async execute(id: string, dto: UpdateToolDto): Promise<ToolEntity> {
    const existingTool = await this.toolRepository.findById(id);
    if (!existingTool) {
      throw new NotFoundException(`Tool with ID "${id}" not found`);
    }

    if (existingTool.isBuiltIn) {
      throw new Error('Cannot update built-in tools');
    }

    const tool = await this.toolRepository.update(id, dto);
    return tool;
  }
}
