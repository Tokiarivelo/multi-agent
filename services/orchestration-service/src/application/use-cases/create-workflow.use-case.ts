import { Injectable, Inject } from '@nestjs/common';
import {
  IWorkflowRepository,
  WORKFLOW_REPOSITORY,
} from '../../domain/repositories/workflow.repository.interface';
import { Workflow, WorkflowStatus } from '../../domain/entities/workflow.entity';
import { CreateWorkflowDto } from '../dto/create-workflow.dto';

@Injectable()
export class CreateWorkflowUseCase {
  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepository: IWorkflowRepository,
  ) {}

  async execute(dto: CreateWorkflowDto, userId: string): Promise<Workflow> {
    const status = dto.status || WorkflowStatus.DRAFT;
    const workflowData = {
      name: dto.name,
      description: dto.description || '',
      definition: dto.definition ?? { nodes: [], edges: [], version: 1 },
      status,
      userId,
    };

    const workflow = await this.workflowRepository.create(workflowData);

    if (status !== WorkflowStatus.DRAFT) {
      const validation = workflow.validate();
      if (!validation.valid) {
        throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
      }
    }

    return workflow;
  }
}
