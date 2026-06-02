import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface InstalledTemplate {
  id: string;
  name: string;
  forkedFromId: string | null;
}

@Injectable()
export class InstallTemplateUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(templateId: string, userId: string): Promise<InstalledTemplate> {
    const template = await this.prisma.workflow.findFirst({
      where: { id: templateId, isTemplate: true, visibility: 'PUBLIC' as const },
    });

    if (!template) throw new NotFoundException(`Template ${templateId} not found`);

    const definition = (template.definition as Record<string, unknown> | null) ?? {
      nodes: template.nodes,
      edges: template.edges,
      version: 1,
    };

    const newWorkflow = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workflow.create({
        data: {
          name: template.name,
          description: template.description,
          nodes: template.nodes as never,
          edges: template.edges as never,
          definition: { ...definition, version: 1 } as never,
          status: 'DRAFT',
          visibility: 'PRIVATE',
          userId,
          forkedFromId: template.id,
        },
        select: { id: true, name: true, forkedFromId: true },
      });

      await tx.workflow.update({
        where: { id: templateId },
        data: { installsCount: { increment: 1 } },
        select: { id: true },
      });

      await tx.workflowInstallation.create({
        data: { templateId, installedWorkflowId: created.id, installerId: userId },
      });

      return created;
    });

    return newWorkflow as InstalledTemplate;
  }
}
