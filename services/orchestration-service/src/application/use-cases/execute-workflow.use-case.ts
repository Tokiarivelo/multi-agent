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

    if (dto.disabledNodeTypes && dto.disabledNodeTypes.length > 0) {
      const disabled = new Set(dto.disabledNodeTypes);
      const nodes = (workflow.definition?.nodes ?? []) as Array<{
        id: string;
        type?: string;
        customName?: string;
        data?: { customName?: string };
      }>;
      const blocked = nodes.filter((n) => n.type && disabled.has(n.type));
      if (blocked.length > 0) {
        const details = blocked
          .map((n) => {
            const name = n.customName ?? n.data?.customName ?? n.id;
            return `"${name}" (${n.type})`;
          })
          .join(', ');
        throw new BadRequestException(
          `Cannot execute workflow: the following nodes use disabled or deleted node types — ${details}. Re-enable the node types or remove these nodes before running.`,
        );
      }
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

  async testNode(
    workflowId: string,
    nodeId: string,
    input: Record<string, unknown>,
    userId: string,
    nodeType?: string,
    nodeConfig?: Record<string, unknown>,
    executionId?: string,
  ): Promise<{ input: unknown; output: unknown; error?: string; logs: string[] }> {
    return this.workflowExecutor.testNode(
      workflowId,
      nodeId,
      input,
      userId,
      nodeType,
      nodeConfig,
      executionId,
    );
  }
}
