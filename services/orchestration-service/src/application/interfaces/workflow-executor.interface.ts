import { WorkflowExecution } from '../../domain/entities/workflow-execution.entity';

export interface IWorkflowExecutor {
  execute(workflowId: string, input: any, userId: string): Promise<WorkflowExecution>;

  getExecutionStatus(executionId: string): Promise<WorkflowExecution | null>;

  cancelExecution(executionId: string): Promise<void>;
}

export const WORKFLOW_EXECUTOR = Symbol('WORKFLOW_EXECUTOR');
