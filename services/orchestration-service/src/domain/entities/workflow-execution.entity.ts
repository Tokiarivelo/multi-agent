export enum ExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum NodeExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export interface NodeExecution {
  nodeId: string;
  status: NodeExecutionStatus;
  input?: any;
  output?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
}

export class WorkflowExecution {
  id!: string;
  workflowId!: string;
  status!: ExecutionStatus;
  input?: any;
  output?: any;
  error?: string;
  nodeExecutions!: NodeExecution[];
  currentNodeId?: string;
  startedAt?: Date;
  completedAt?: Date;
  userId!: string;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(partial: Partial<WorkflowExecution>) {
    Object.assign(this, partial);
    if (!this.nodeExecutions) {
      this.nodeExecutions = [];
    }
  }

  start(): void {
    this.status = ExecutionStatus.RUNNING;
    this.startedAt = new Date();
  }

  complete(output?: any): void {
    this.status = ExecutionStatus.COMPLETED;
    this.output = output;
    this.completedAt = new Date();
  }

  fail(error: string): void {
    this.status = ExecutionStatus.FAILED;
    this.error = error;
    this.completedAt = new Date();
  }

  cancel(): void {
    this.status = ExecutionStatus.CANCELLED;
    this.completedAt = new Date();
  }

  startNodeExecution(nodeId: string, input?: any): void {
    this.currentNodeId = nodeId;
    const existingIndex = this.nodeExecutions.findIndex((n) => n.nodeId === nodeId);

    if (existingIndex >= 0) {
      this.nodeExecutions[existingIndex] = {
        ...this.nodeExecutions[existingIndex],
        status: NodeExecutionStatus.RUNNING,
        input,
        startedAt: new Date(),
      };
    } else {
      this.nodeExecutions.push({
        nodeId,
        status: NodeExecutionStatus.RUNNING,
        input,
        startedAt: new Date(),
        retryCount: 0,
      });
    }
  }

  completeNodeExecution(nodeId: string, output?: any): void {
    const execution = this.nodeExecutions.find((n) => n.nodeId === nodeId);
    if (execution) {
      execution.status = NodeExecutionStatus.COMPLETED;
      execution.output = output;
      execution.completedAt = new Date();
    }
  }

  failNodeExecution(nodeId: string, error: string): void {
    const execution = this.nodeExecutions.find((n) => n.nodeId === nodeId);
    if (execution) {
      execution.status = NodeExecutionStatus.FAILED;
      execution.error = error;
      execution.completedAt = new Date();
    }
  }

  skipNodeExecution(nodeId: string): void {
    const execution = this.nodeExecutions.find((n) => n.nodeId === nodeId);
    if (execution) {
      execution.status = NodeExecutionStatus.SKIPPED;
      execution.completedAt = new Date();
    }
  }

  incrementRetryCount(nodeId: string): void {
    const execution = this.nodeExecutions.find((n) => n.nodeId === nodeId);
    if (execution) {
      execution.retryCount++;
    }
  }

  getNodeExecution(nodeId: string): NodeExecution | undefined {
    return this.nodeExecutions.find((n) => n.nodeId === nodeId);
  }

  isRunning(): boolean {
    return this.status === ExecutionStatus.RUNNING;
  }

  isCompleted(): boolean {
    return this.status === ExecutionStatus.COMPLETED;
  }

  isFailed(): boolean {
    return this.status === ExecutionStatus.FAILED;
  }
}
