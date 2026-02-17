import { Injectable } from '@nestjs/common';
import { ToolRepository } from '@domain/tool.repository.interface';
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
        parameters: tool.parameters,
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

  async findAll(filters?: { category?: ToolCategory; isBuiltIn?: boolean }): Promise<ToolEntity[]> {
    const tools = await this.prisma.tool.findMany({
      where: {
        ...(filters?.category && { category: filters.category }),
        ...(filters?.isBuiltIn !== undefined && { isBuiltIn: filters.isBuiltIn }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return tools.map(ToolEntity.fromPrisma);
  }

  async update(id: string, updates: Partial<ToolEntity>): Promise<ToolEntity> {
    const updated = await this.prisma.tool.update({
      where: { id },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.description && { description: updates.description }),
        ...(updates.category && { category: updates.category }),
        ...(updates.parameters && { parameters: updates.parameters }),
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

  async search(query: string): Promise<ToolEntity[]> {
    const tools = await this.prisma.tool.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return tools.map(ToolEntity.fromPrisma);
  }
}
