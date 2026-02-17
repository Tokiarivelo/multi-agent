import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ToolRepository } from '@domain/tool.repository.interface';
import { ToolEntity } from '@domain/tool.entity';
import { ListToolsDto } from '@application/dto/list-tools.dto';

@Injectable()
export class ListToolsUseCase {
  constructor(
    @Inject('ToolRepository')
    private readonly toolRepository: ToolRepository,
  ) {}

  async execute(dto: ListToolsDto): Promise<ToolEntity[]> {
    if (dto.search) {
      return this.toolRepository.search(dto.search);
    }

    return this.toolRepository.findAll({
      category: dto.category,
      isBuiltIn: dto.isBuiltIn,
    });
  }
}
