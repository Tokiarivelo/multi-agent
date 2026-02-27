import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import {
  IWorkflowRepository,
  WORKFLOW_REPOSITORY,
} from '../../domain/repositories/workflow.repository.interface';
import { IWorkflowExecutor, WORKFLOW_EXECUTOR } from '../interfaces/workflow-executor.interface';
import { WorkflowExecution } from '../../domain/entities/workflow-execution.entity';
import { ExecuteWorkflowDto } from '../dto/execute-workflow.dto';

@Injectable()
export class ExecuteWorkflowUseCase {
  private readonly logger = new Logger(ExecuteWorkflowUseCase.name);

  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepository: IWorkflowRepository,
    @Inject(WORKFLOW_EXECUTOR)
    private readonly workflowExecutor: IWorkflowExecutor,
  ) {}

  async execute(dto: ExecuteWorkflowDto, userId: string): Promise<WorkflowExecution> {
    const workflow = await this.workflowRepository.findById(dto.workflowId);

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${dto.workflowId} not found`);
    }

    if (!workflow.isActive()) {
      throw new BadRequestException(
        `Workflow ${dto.workflowId} is not active and cannot be executed`,
      );
    }

    const validation = workflow.validate();
    if (!validation.valid) {
      throw new BadRequestException(`Workflow validation failed: ${validation.errors.join(', ')}`);
    }

    this.logger.log(`Starting execution of workflow ${dto.workflowId} for user ${userId}`);

    try {
      const execution = await this.workflowExecutor.execute(
        dto.workflowId,
        dto.input || {},
        userId,
      );

      return execution;
    } catch (error) {
      this.logger.error(
        `Failed to execute workflow ${dto.workflowId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async getExecutionStatus(executionId: string): Promise<WorkflowExecution> {
    const execution = await this.workflowExecutor.getExecutionStatus(executionId);

    if (!execution) {
      throw new NotFoundException(`Execution with ID ${executionId} not found`);
    }

    return execution;
  }

  async cancelExecution(executionId: string): Promise<void> {
    await this.workflowExecutor.cancelExecution(executionId);
  }

  resumeNode(executionId: string, nodeId: string, response: string): void {
    this.workflowExecutor.resumePromptNode(executionId, nodeId, response);
  }
}
