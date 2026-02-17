import { Injectable, ConflictException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ToolRepository } from '@domain/tool.repository.interface';
import { ToolEntity } from '@domain/tool.entity';
import { CreateToolDto } from '@application/dto/create-tool.dto';

@Injectable()
export class CreateToolUseCase {
  constructor(
    @Inject('ToolRepository')
    private readonly toolRepository: ToolRepository,
  ) {}

  async execute(dto: CreateToolDto): Promise<ToolEntity> {
    const existingTool = await this.toolRepository.findByName(dto.name);
    if (existingTool) {
      throw new ConflictException(`Tool with name "${dto.name}" already exists`);
    }

    if (dto.category === 'CUSTOM' && !dto.code) {
      throw new ConflictException('Custom tools must have code');
    }

    const tool = await this.toolRepository.create({
      name: dto.name,
      description: dto.description,
      category: dto.category,
      parameters: dto.parameters,
      code: dto.code || null,
      isBuiltIn: dto.isBuiltIn || false,
    } as any);

    return tool;
  }
}
