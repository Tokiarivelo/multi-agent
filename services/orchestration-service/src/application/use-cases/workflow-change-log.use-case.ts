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
import {
  WorkflowChangeLog,
  InvitationStatus,
} from '../../domain/entities/workflow-collaboration.entity';
import { WorkflowVisibility } from '../../domain/entities/workflow.entity';

export interface PaginatedChangeLogs {
  data: WorkflowChangeLog[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class WorkflowChangeLogUseCase {
  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepo: IWorkflowRepository,
    @Inject(WORKFLOW_COLLABORATOR_REPOSITORY)
    private readonly collaboratorRepo: IWorkflowCollaboratorRepository,
    @Inject(WORKFLOW_CHANGE_LOG_REPOSITORY)
    private readonly changeLogRepo: IWorkflowChangeLogRepository,
  ) {}

  async getHistory(
    workflowId: string,
    userId: string,
    page = 1,
    limit = 30,
  ): Promise<PaginatedChangeLogs> {
    const workflow = await this.workflowRepo.findById(workflowId);
    if (!workflow) throw new NotFoundException('Workflow not found');

    const canView = await this.canView(workflow, userId);
    if (!canView) throw new ForbiddenException('You do not have access to this workflow history');

    const offset = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.changeLogRepo.findByWorkflowId(workflowId, limit, offset),
      this.changeLogRepo.countByWorkflowId(workflowId),
    ]);

    return { data, total, page, limit };
  }

  private async canView(workflow: any, userId: string): Promise<boolean> {
    if (workflow.userId === userId) return true;
    if (workflow.visibility === WorkflowVisibility.PUBLIC) return true;
    const collaborator = await this.collaboratorRepo.findOne(workflow.id, userId);
    return collaborator?.status === InvitationStatus.ACCEPTED;
  }
}
