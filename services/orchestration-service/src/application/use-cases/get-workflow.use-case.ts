import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IWorkflowRepository,
  WORKFLOW_REPOSITORY,
  PaginatedWorkflows,
} from '../../domain/repositories/workflow.repository.interface';
import { Workflow } from '../../domain/entities/workflow.entity';

@Injectable()
export class GetWorkflowUseCase {
  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepository: IWorkflowRepository,
  ) {}

  async execute(workflowId: string): Promise<Workflow> {
    const workflow = await this.workflowRepository.findById(workflowId);

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${workflowId} not found`);
    }

    return workflow;
  }

  async getByUserId(userId: string, page?: number, limit?: number): Promise<PaginatedWorkflows> {
    return this.workflowRepository.findByUserId(userId, page, limit);
  }

  async getAll(page?: number, limit?: number): Promise<PaginatedWorkflows> {
    return this.workflowRepository.findAll(page, limit);
  }
}
