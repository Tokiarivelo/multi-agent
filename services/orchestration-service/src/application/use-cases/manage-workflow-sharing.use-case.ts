import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
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
import {
  WorkflowCollaborator,
  CollaboratorRole,
  InvitationStatus,
  ChangeAction,
} from '../../domain/entities/workflow-collaboration.entity';
import { WorkflowVisibility } from '../../domain/entities/workflow.entity';

@Injectable()
export class ManageWorkflowSharingUseCase {
  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepo: IWorkflowRepository,
    @Inject(WORKFLOW_COLLABORATOR_REPOSITORY)
    private readonly collaboratorRepo: IWorkflowCollaboratorRepository,
    @Inject(WORKFLOW_CHANGE_LOG_REPOSITORY)
    private readonly changeLogRepo: IWorkflowChangeLogRepository,
    private readonly prisma: PrismaService,
  ) {}

  async setVisibility(
    workflowId: string,
    ownerId: string,
    visibility: WorkflowVisibility,
  ): Promise<void> {
    const workflow = await this.workflowRepo.findById(workflowId);
    if (!workflow) throw new NotFoundException('Workflow not found');
    if (workflow.userId !== ownerId)
      throw new ForbiddenException('Only the owner can change visibility');

    await this.workflowRepo.update(workflowId, { visibility });
    await this.changeLogRepo.create({
      workflowId,
      userId: ownerId,
      action: ChangeAction.VISIBILITY_CHANGED,
      details: { from: workflow.visibility, to: visibility },
    });
  }

  async listCollaborators(
    workflowId: string,
    requesterId: string,
  ): Promise<WorkflowCollaborator[]> {
    const workflow = await this.workflowRepo.findById(workflowId);
    if (!workflow) throw new NotFoundException('Workflow not found');
    if (workflow.userId !== requesterId) {
      const collaborator = await this.collaboratorRepo.findOne(workflowId, requesterId);
      if (!collaborator || collaborator.status !== InvitationStatus.ACCEPTED) {
        throw new ForbiddenException('Access denied');
      }
    }
    return this.collaboratorRepo.findByWorkflowId(workflowId);
  }

  async updateCollaboratorRole(
    workflowId: string,
    collaboratorId: string,
    ownerId: string,
    role: CollaboratorRole,
  ): Promise<WorkflowCollaborator> {
    const workflow = await this.workflowRepo.findById(workflowId);
    if (!workflow) throw new NotFoundException('Workflow not found');
    if (workflow.userId !== ownerId)
      throw new ForbiddenException('Only the owner can update roles');

    const collaborators = await this.collaboratorRepo.findByWorkflowId(workflowId);
    const collaborator = collaborators.find((c) => c.id === collaboratorId);
    if (!collaborator) throw new NotFoundException('Collaborator not found');

    return this.collaboratorRepo.updateRole(collaboratorId, role);
  }

  async removeCollaborator(
    workflowId: string,
    collaboratorId: string,
    ownerId: string,
  ): Promise<void> {
    const workflow = await this.workflowRepo.findById(workflowId);
    if (!workflow) throw new NotFoundException('Workflow not found');
    if (workflow.userId !== ownerId)
      throw new ForbiddenException('Only the owner can remove collaborators');

    const collaborators = await this.collaboratorRepo.findByWorkflowId(workflowId);
    const collaborator = collaborators.find((c) => c.id === collaboratorId);
    if (!collaborator) throw new NotFoundException('Collaborator not found');

    await this.collaboratorRepo.delete(collaboratorId);
  }

  async listPublicWorkflows(page = 1, limit = 20) {
    return this.workflowRepo.findPublic(page, limit);
  }

  async listSharedWithMe(userId: string, page = 1, limit = 20) {
    return this.workflowRepo.findSharedWithUser(userId, page, limit);
  }
}
