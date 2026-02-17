import { ExecutionEntity } from '../entities/execution.entity';

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IExecutionRepository {
  findById(id: string): Promise<ExecutionEntity | null>;
  findAll(options: PaginationOptions): Promise<PaginatedResult<ExecutionEntity>>;
  create(execution: ExecutionEntity): Promise<ExecutionEntity>;
  update(execution: ExecutionEntity): Promise<ExecutionEntity>;
  delete(id: string): Promise<void>;
}

export const IExecutionRepository = Symbol('IExecutionRepository');
