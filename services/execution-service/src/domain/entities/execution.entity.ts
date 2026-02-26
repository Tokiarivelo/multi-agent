export enum ExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export class ExecutionEntity {
  constructor(
    public readonly id: string,
    public readonly workflowId: string,
    public readonly userId: string,
    public readonly status: ExecutionStatus,
    public readonly startedAt: Date,
    public readonly completedAt: Date | null,
    public readonly error: string | null,
    public readonly metadata: Record<string, any>,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static create(data: {
    id: string;
    workflowId: string;
    userId: string;
    metadata?: Record<string, any>;
  }): ExecutionEntity {
    return new ExecutionEntity(
      data.id,
      data.workflowId,
      data.userId,
      ExecutionStatus.PENDING,
      new Date(),
      null,
      null,
      data.metadata || {},
      new Date(),
      new Date(),
    );
  }

  start(): ExecutionEntity {
    return new ExecutionEntity(
      this.id,
      this.workflowId,
      this.userId,
      ExecutionStatus.RUNNING,
      this.startedAt,
      null,
      null,
      this.metadata,
      this.createdAt,
      new Date(),
    );
  }

  complete(): ExecutionEntity {
    return new ExecutionEntity(
      this.id,
      this.workflowId,
      this.userId,
      ExecutionStatus.COMPLETED,
      this.startedAt,
      new Date(),
      null,
      this.metadata,
      this.createdAt,
      new Date(),
    );
  }

  fail(error: string): ExecutionEntity {
    return new ExecutionEntity(
      this.id,
      this.workflowId,
      this.userId,
      ExecutionStatus.FAILED,
      this.startedAt,
      new Date(),
      error,
      this.metadata,
      this.createdAt,
      new Date(),
    );
  }

  cancel(): ExecutionEntity {
    return new ExecutionEntity(
      this.id,
      this.workflowId,
      this.userId,
      ExecutionStatus.CANCELLED,
      this.startedAt,
      new Date(),
      null,
      this.metadata,
      this.createdAt,
      new Date(),
    );
  }

  isRetryable(): boolean {
    return this.status === ExecutionStatus.FAILED;
  }
}
