import { WorkflowExecution } from '../../domain/entities/workflow-execution.entity';

export interface IWorkflowExecutor {
  execute(workflowId: string, input: any, userId: string): Promise<WorkflowExecution>;

  getExecutionStatus(executionId: string): Promise<WorkflowExecution | null>;

  cancelExecution(executionId: string): Promise<void>;

  resumePromptNode(executionId: string, nodeId: string, response: string): void;

  testNode(
    workflowId: string,
    nodeId: string,
    input: Record<string, unknown>,
    userId: string,
    nodeType?: string,
    nodeConfig?: Record<string, unknown>,
    executionId?: string,
  ): Promise<{ input: unknown; output: unknown; error?: string; logs: string[] }>;
}

export const WORKFLOW_EXECUTOR = Symbol('WORKFLOW_EXECUTOR');
