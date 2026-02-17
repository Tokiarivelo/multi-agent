import { ExecutionLogEntity } from '../entities/execution-log.entity';

export interface IExecutionLogRepository {
  findById(id: string): Promise<ExecutionLogEntity | null>;
  findByExecutionId(executionId: string): Promise<ExecutionLogEntity[]>;
  findByNodeId(executionId: string, nodeId: string): Promise<ExecutionLogEntity | null>;
  create(log: ExecutionLogEntity): Promise<ExecutionLogEntity>;
  update(log: ExecutionLogEntity): Promise<ExecutionLogEntity>;
  delete(id: string): Promise<void>;
}

export const IExecutionLogRepository = Symbol('IExecutionLogRepository');
