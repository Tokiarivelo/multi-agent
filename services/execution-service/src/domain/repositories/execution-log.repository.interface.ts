import { ExecutionLogEntity } from '../entities/execution-log.entity';
import { PaginationOptions, PaginatedResult } from './execution.repository.interface';

export interface IExecutionLogRepository {
  findById(id: string): Promise<ExecutionLogEntity | null>;
  findByExecutionId(
    executionId: string,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<ExecutionLogEntity>>;
  findByNodeId(executionId: string, nodeId: string): Promise<ExecutionLogEntity | null>;
  create(log: ExecutionLogEntity): Promise<ExecutionLogEntity>;
  update(log: ExecutionLogEntity): Promise<ExecutionLogEntity>;
  delete(id: string): Promise<void>;
}

export const IExecutionLogRepository = Symbol('IExecutionLogRepository');
