import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ToolRepository, PaginatedTools } from '@domain/tool.repository.interface';
import { ListToolsDto } from '@application/dto/list-tools.dto';

@Injectable()
export class ListToolsUseCase {
  constructor(
    @Inject('ToolRepository')
    private readonly toolRepository: ToolRepository,
  ) {}

  async execute(dto: ListToolsDto): Promise<PaginatedTools> {
    const limit = dto.pageSize || 20;

    if (dto.search) {
      return this.toolRepository.search(dto.search, dto.page, limit);
    }

    return this.toolRepository.findAll({
      category: dto.category,
      isBuiltIn: dto.isBuiltIn,
      page: dto.page,
      limit,
    });
  }
}
