import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  IWorkflowRepository,
  WORKFLOW_REPOSITORY,
} from '../../domain/repositories/workflow.repository.interface';
import {
  IWorkflowCollaboratorRepository,
  IWorkflowChangeLogRepository,
  WORKFLOW_COLLABORATOR_REPOSITORY,
  WORKFLOW_CHANGE_LOG_REPOSITORY,
} from '../../domain/repositories/workflow-collaboration.repository.interface';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  Workflow,
  WorkflowStatus,
  WorkflowVisibility,
} from '../../domain/entities/workflow.entity';
import {
  ChangeAction,
  InvitationStatus,
} from '../../domain/entities/workflow-collaboration.entity';
import { ForkWorkflowDto } from '../dto/workflow-sharing.dto';

@Injectable()
export class ForkWorkflowUseCase {
  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepo: IWorkflowRepository,
    @Inject(WORKFLOW_COLLABORATOR_REPOSITORY)
    private readonly collaboratorRepo: IWorkflowCollaboratorRepository,
    @Inject(WORKFLOW_CHANGE_LOG_REPOSITORY)
    private readonly changeLogRepo: IWorkflowChangeLogRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(workflowId: string, userId: string, dto: ForkWorkflowDto): Promise<Workflow> {
    const original = await this.workflowRepo.findById(workflowId);
    if (!original) throw new NotFoundException('Workflow not found');

    // Owner or accepted collaborator can fork freely
    const isFree = await this.canForkFree(original, userId);
    if (isFree) return this.createFork(original, userId, dto.name);

    // Public workflow: requires an approved fork request
    if (original.visibility === WorkflowVisibility.PUBLIC) {
      const approved = await this.prisma.workflowForkRequest.findFirst({
        where: { workflowId, requesterId: userId, status: 'APPROVED' },
      });
      if (!approved) {
        throw new ForbiddenException(
          'You need an approved fork request to fork this public workflow',
        );
      }
      return this.createFork(original, userId, dto.name);
    }

    throw new ForbiddenException('You do not have access to fork this workflow');
  }

  /** Called internally when a fork request is approved — bypasses the access check. */
  async executeApproved(workflowId: string, userId: string): Promise<Workflow> {
    const original = await this.workflowRepo.findById(workflowId);
    if (!original) throw new NotFoundException('Workflow not found');
    return this.createFork(original, userId);
  }

  async checkUpstreamChanges(
    forkId: string,
    userId: string,
  ): Promise<{ hasChanges: boolean; upstreamUpdatedAt?: Date }> {
    const fork = await this.workflowRepo.findById(forkId);
    if (!fork) throw new NotFoundException('Fork not found');
    if (fork.userId !== userId) throw new ForbiddenException('Not your fork');
    if (!fork.forkedFromId) return { hasChanges: false };

    const upstream = await this.workflowRepo.findById(fork.forkedFromId);
    if (!upstream) return { hasChanges: false };

    const hasChanges = upstream.updatedAt > fork.createdAt;
    return { hasChanges, upstreamUpdatedAt: upstream.updatedAt };
  }

  async pullUpstreamChanges(forkId: string, userId: string): Promise<Workflow> {
    const fork = await this.workflowRepo.findById(forkId);
    if (!fork) throw new NotFoundException('Fork not found');
    if (fork.userId !== userId) throw new ForbiddenException('Not your fork');
    if (!fork.forkedFromId) throw new ForbiddenException('This workflow is not a fork');

    const upstream = await this.workflowRepo.findById(fork.forkedFromId);
    if (!upstream) throw new NotFoundException('Upstream workflow not found');

    const updated = await this.workflowRepo.update(forkId, {
      definition: { ...upstream.definition, version: fork.definition.version + 1 },
    });

    await this.changeLogRepo.create({
      workflowId: forkId,
      userId,
      action: ChangeAction.SETTINGS_UPDATED,
      details: {
        action: 'pull_upstream',
        upstreamId: fork.forkedFromId,
        upstreamVersion: upstream.definition.version,
      },
    });

    return updated;
  }

  private async createFork(original: Workflow, userId: string, name?: string): Promise<Workflow> {
    const fork = await this.workflowRepo.create({
      name: name ?? `${original.name} (fork)`,
      description: original.description,
      definition: { ...original.definition, version: 1 },
      status: WorkflowStatus.DRAFT,
      visibility: WorkflowVisibility.PRIVATE,
      userId,
      forkedFromId: original.id,
    });

    await this.changeLogRepo.create({
      workflowId: fork.id,
      userId,
      action: ChangeAction.FORKED,
      details: { forkedFrom: original.id, originalName: original.name },
    });

    return fork;
  }

  private async canForkFree(workflow: Workflow, userId: string): Promise<boolean> {
    if (workflow.userId === userId) return true;
    const collaborator = await this.collaboratorRepo.findOne(workflow.id, userId);
    return collaborator?.status === InvitationStatus.ACCEPTED;
  }
}
