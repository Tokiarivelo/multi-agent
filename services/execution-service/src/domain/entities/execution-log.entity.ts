export enum ExecutionLogStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export class ExecutionLogEntity {
  constructor(
    public readonly id: string,
    public readonly executionId: string,
    public readonly nodeId: string,
    public readonly nodeName: string,
    public readonly status: ExecutionLogStatus,
    public readonly input: Record<string, any> | null,
    public readonly output: Record<string, any> | null,
    public readonly error: string | null,
    public readonly startedAt: Date,
    public readonly completedAt: Date | null,
    public readonly duration: number | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static create(data: {
    id: string;
    executionId: string;
    nodeId: string;
    nodeName: string;
    input?: Record<string, any>;
  }): ExecutionLogEntity {
    return new ExecutionLogEntity(
      data.id,
      data.executionId,
      data.nodeId,
      data.nodeName,
      ExecutionLogStatus.PENDING,
      data.input || null,
      null,
      null,
      new Date(),
      null,
      null,
      new Date(),
      new Date(),
    );
  }

  start(): ExecutionLogEntity {
    return new ExecutionLogEntity(
      this.id,
      this.executionId,
      this.nodeId,
      this.nodeName,
      ExecutionLogStatus.RUNNING,
      this.input,
      null,
      null,
      this.startedAt,
      null,
      null,
      this.createdAt,
      new Date(),
    );
  }

  complete(output: Record<string, any>): ExecutionLogEntity {
    const completedAt = new Date();
    const duration = completedAt.getTime() - this.startedAt.getTime();

    return new ExecutionLogEntity(
      this.id,
      this.executionId,
      this.nodeId,
      this.nodeName,
      ExecutionLogStatus.COMPLETED,
      this.input,
      output,
      null,
      this.startedAt,
      completedAt,
      duration,
      this.createdAt,
      new Date(),
    );
  }

  fail(error: string): ExecutionLogEntity {
    const completedAt = new Date();
    const duration = completedAt.getTime() - this.startedAt.getTime();

    return new ExecutionLogEntity(
      this.id,
      this.executionId,
      this.nodeId,
      this.nodeName,
      ExecutionLogStatus.FAILED,
      this.input,
      null,
      error,
      this.startedAt,
      completedAt,
      duration,
      this.createdAt,
      new Date(),
    );
  }
}
