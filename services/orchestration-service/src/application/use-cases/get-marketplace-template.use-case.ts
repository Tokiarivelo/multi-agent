import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TemplateListItem } from './list-marketplace-templates.use-case';

export interface TemplateDetail extends TemplateListItem {
  nodes: unknown;
  edges: unknown;
  definition: unknown;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class GetMarketplaceTemplateUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string): Promise<TemplateDetail> {
    const template = await this.prisma.workflow.findFirst({
      where: { id, isTemplate: true, visibility: 'PUBLIC' as const },
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
        nodes: true,
        edges: true,
        definition: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!template) throw new NotFoundException(`Template ${id} not found`);

    return template as TemplateDetail;
  }
}
