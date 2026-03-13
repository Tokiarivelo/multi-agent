import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { IExecutionLogRepository } from '../../domain/repositories/execution-log.repository.interface';
import {
  PaginationOptions,
  PaginatedResult,
} from '../../domain/repositories/execution.repository.interface';
import { ExecutionLogEntity, ExecutionLogStatus } from '../../domain/entities/execution-log.entity';

@Injectable()
export class ExecutionLogRepository implements IExecutionLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(_id: string): Promise<ExecutionLogEntity | null> {
    return null; // Not supported directly since logs are inside workflowExecution
  }

  async findByExecutionId(
    executionId: string,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<ExecutionLogEntity>> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const workflowExecution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
    });

    if (!workflowExecution) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    const nodeExecutions: any[] = Array.isArray(workflowExecution.nodeExecutions)
      ? workflowExecution.nodeExecutions
      : [];

    const total = nodeExecutions.length;
    const logs = nodeExecutions.map((log: any, index: number) => {
      let duration = null;
      if (log.startedAt && log.completedAt) {
        duration = new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime();
      }
      return new ExecutionLogEntity(
        `${workflowExecution.id}_${index}`,
        workflowExecution.id,
        log.nodeId,
        log.nodeName || log.nodeId,
        log.status as ExecutionLogStatus,
        log.input || null,
        log.output || null,
        log.error || null,
        log.startedAt
          ? new Date(log.startedAt)
          : new Date(workflowExecution.startedAt || Date.now()),
        log.completedAt ? new Date(log.completedAt) : null,
        duration,
        workflowExecution.createdAt,
        workflowExecution.updatedAt,
      );
    });

    logs.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
    const paginatedLogs = logs.slice(skip, skip + limit);

    return {
      data: paginatedLogs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByNodeId(_executionId: string, _nodeId: string): Promise<ExecutionLogEntity | null> {
    return null;
  }

  async create(log: ExecutionLogEntity): Promise<ExecutionLogEntity> {
    return log;
  }

  async update(log: ExecutionLogEntity): Promise<ExecutionLogEntity> {
    return log;
  }

  async delete(_id: string): Promise<void> {
    // No-op
  }
}
