import { Injectable } from '@nestjs/common';
import { ToolRepository, PaginatedTools } from '@domain/tool.repository.interface';
import { ToolEntity, ToolCategory } from '@domain/tool.entity';
import { PrismaService } from '@infrastructure/database/prisma.service';

@Injectable()
export class PrismaToolRepository implements ToolRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(tool: Omit<ToolEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<ToolEntity> {
    const created = await this.prisma.tool.create({
      data: {
        name: tool.name,
        description: tool.description,
        category: tool.category,
        parameters: tool.parameters as any,
        code: tool.code,
        isBuiltIn: tool.isBuiltIn,
      },
    });

    return ToolEntity.fromPrisma(created);
  }

  async findById(id: string): Promise<ToolEntity | null> {
    const tool = await this.prisma.tool.findUnique({
      where: { id },
    });

    return tool ? ToolEntity.fromPrisma(tool) : null;
  }

  async findByName(name: string): Promise<ToolEntity | null> {
    const tool = await this.prisma.tool.findUnique({
      where: { name },
    });

    return tool ? ToolEntity.fromPrisma(tool) : null;
  }

  async findAll(filters?: {
    category?: ToolCategory;
    isBuiltIn?: boolean;
    page?: number;
    limit?: number;
  }): Promise<PaginatedTools> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where = {
      ...(filters?.category && { category: filters.category }),
      ...(filters?.isBuiltIn !== undefined && { isBuiltIn: filters.isBuiltIn }),
    };

    const [total, tools] = await Promise.all([
      this.prisma.tool.count({ where }),
      this.prisma.tool.findMany({
        where,
        take: limit,
        skip,
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    return {
      data: tools.map(ToolEntity.fromPrisma),
      total,
      page,
      limit,
    };
  }

  async update(id: string, updates: Partial<ToolEntity>): Promise<ToolEntity> {
    const updated = await this.prisma.tool.update({
      where: { id },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.description && { description: updates.description }),
        ...(updates.category && { category: updates.category }),
        ...(updates.parameters && { parameters: updates.parameters as any }),
        ...(updates.code !== undefined && { code: updates.code }),
      },
    });

    return ToolEntity.fromPrisma(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.tool.delete({
      where: { id },
    });
  }

  async search(
    query: string,
    pageParam: number = 1,
    limitParam: number = 20,
  ): Promise<PaginatedTools> {
    const page = pageParam || 1;
    const limit = limitParam || 20;
    const skip = (page - 1) * limit;

    const where = {
      OR: [
        { name: { contains: query, mode: 'insensitive' as const } },
        { description: { contains: query, mode: 'insensitive' as const } },
      ],
    };

    const [total, tools] = await Promise.all([
      this.prisma.tool.count({ where }),
      this.prisma.tool.findMany({
        where,
        take: limit,
        skip,
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    return {
      data: tools.map(ToolEntity.fromPrisma),
      total,
      page,
      limit,
    };
  }
}
