import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface ListTemplatesQuery {
  category?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface TemplateListItem {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  installsCount: number;
  previewImageUrl: string | null;
  isFeatured: boolean;
  authorName: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedTemplates {
  data: TemplateListItem[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class ListMarketplaceTemplatesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListTemplatesQuery): Promise<PaginatedTemplates> {
    const { category, search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where = {
      isTemplate: true,
      visibility: 'PUBLIC' as const,
      ...(category && { category }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [total, workflows] = await Promise.all([
      this.prisma.workflow.count({ where }),
      this.prisma.workflow.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          tags: true,
          installsCount: true,
          previewImageUrl: true,
          isFeatured: true,
          authorName: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: limit,
        orderBy: [
          { isFeatured: 'desc' },
          { installsCount: 'desc' },
          { updatedAt: 'desc' },
        ],
      }),
    ]);

    return { data: workflows as TemplateListItem[], total, page, limit };
  }

  async getCategories(): Promise<string[]> {
    const rows = await this.prisma.workflow.groupBy({
      by: ['category'],
      where: { isTemplate: true, visibility: 'PUBLIC' as const, category: { not: null } },
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => r.category).filter((c): c is string => c !== null);
  }
}
