import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IWorkflowRepository,
  WORKFLOW_REPOSITORY,
} from '../../domain/repositories/workflow.repository.interface';

@Injectable()
export class DeleteWorkflowUseCase {
  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepository: IWorkflowRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const workflow = await this.workflowRepository.findById(id);
    if (!workflow) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }
    await this.workflowRepository.delete(id);
  }
}
