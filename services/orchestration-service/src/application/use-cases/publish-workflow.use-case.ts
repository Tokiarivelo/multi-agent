import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface PublishWorkflowInput {
  workflowId: string;
  userId: string;
  name?: string;
  description: string;
  category: string;
  tags?: string[];
  previewImageUrl?: string;
  isFeatured?: boolean;
}

export interface UpdatePublishedInput {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  previewImageUrl?: string;
  isFeatured?: boolean;
}

export interface PublishedWorkflowResult {
  id: string;
  name: string;
  category: string | null;
  authorName: string | null;
  isTemplate: boolean;
}

@Injectable()
export class PublishWorkflowUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async publish(input: PublishWorkflowInput): Promise<PublishedWorkflowResult> {
    const { workflowId, userId, description, category, tags = [], previewImageUrl, isFeatured } = input;

    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { id: true, name: true, userId: true, isTemplate: true, forkedFromId: true },
    });

    if (!workflow) throw new NotFoundException(`Workflow ${workflowId} not found`);
    if (workflow.userId !== userId) throw new ForbiddenException('You do not own this workflow');
    if (workflow.isTemplate) throw new ConflictException('Workflow is already published to the marketplace');

    if (workflow.forkedFromId) {
      const parent = await this.prisma.workflow.findUnique({
        where: { id: workflow.forkedFromId },
        select: { isTemplate: true },
      });
      if (parent?.isTemplate) {
        throw new ForbiddenException('Workflows installed from the marketplace cannot be published');
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true, role: true },
    });

    const authorName = user
      ? (`${user.firstName} ${user.lastName}`.trim() || user.email)
      : 'Unknown';

    const canSetFeatured = user?.role === 'ADMIN';

    const updated = await this.prisma.workflow.update({
      where: { id: workflowId },
      data: {
        isTemplate: true,
        visibility: 'PUBLIC',
        name: input.name?.trim() || workflow.name,
        description,
        category,
        tags,
        previewImageUrl: previewImageUrl ?? null,
        isFeatured: canSetFeatured ? (isFeatured ?? false) : false,
        authorName,
        installsCount: 0,
      },
      select: { id: true, name: true, category: true, authorName: true, isTemplate: true },
    });

    return updated as PublishedWorkflowResult;
  }

  async unpublish(workflowId: string, userId: string): Promise<void> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { id: true, userId: true, isTemplate: true },
    });

    if (!workflow) throw new NotFoundException(`Workflow ${workflowId} not found`);
    if (workflow.userId !== userId) throw new ForbiddenException('You do not own this workflow');
    if (!workflow.isTemplate) throw new ConflictException('Workflow is not currently published');

    await this.prisma.workflow.update({
      where: { id: workflowId },
      data: { isTemplate: false, visibility: 'PRIVATE', isFeatured: false },
    });
  }

  async updatePublished(
    workflowId: string,
    userId: string,
    data: UpdatePublishedInput,
  ): Promise<PublishedWorkflowResult> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { id: true, name: true, userId: true, isTemplate: true },
    });

    if (!workflow) throw new NotFoundException(`Workflow ${workflowId} not found`);
    if (workflow.userId !== userId) throw new ForbiddenException('You do not own this workflow');
    if (!workflow.isTemplate) throw new ConflictException('Workflow is not published');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const canSetFeatured = user?.role === 'ADMIN';

    const updated = await this.prisma.workflow.update({
      where: { id: workflowId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.previewImageUrl !== undefined && { previewImageUrl: data.previewImageUrl }),
        ...(data.isFeatured !== undefined && canSetFeatured && { isFeatured: data.isFeatured }),
      },
      select: { id: true, name: true, category: true, authorName: true, isTemplate: true },
    });

    return updated as PublishedWorkflowResult;
  }
}
