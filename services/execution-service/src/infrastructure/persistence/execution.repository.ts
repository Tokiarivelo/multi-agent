import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  IExecutionRepository,
  PaginationOptions,
  PaginatedResult,
} from '../../domain/repositories/execution.repository.interface';
import { ExecutionEntity, ExecutionStatus } from '../../domain/entities/execution.entity';

@Injectable()
export class ExecutionRepository implements IExecutionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ExecutionEntity | null> {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id },
      include: { workflow: true },
    });

    if (!execution) {
      return null;
    }

    return this.toDomain(execution);
  }

  async findAll(options: PaginationOptions): Promise<PaginatedResult<ExecutionEntity>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [executions, total] = await Promise.all([
      this.prisma.workflowExecution.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { workflow: true },
      }),
      this.prisma.workflowExecution.count(),
    ]);

    return {
      data: executions.map((e) => this.toDomain(e)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(execution: ExecutionEntity): Promise<ExecutionEntity> {
    const created = await this.prisma.workflowExecution.create({
      data: {
        id: execution.id,
        workflowId: execution.workflowId,
        userId: execution.userId,
        status: execution.status as any,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        error: execution.error,
        nodeExecutions: execution.metadata?.nodeExecutions || [],
        input: execution.metadata?.input || {},
        output: execution.metadata?.output || {},
      },
      include: { workflow: true },
    });

    return this.toDomain(created);
  }

  async update(execution: ExecutionEntity): Promise<ExecutionEntity> {
    const updated = await this.prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: execution.status as any,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        error: execution.error,
        nodeExecutions: execution.metadata?.nodeExecutions || [],
        input: execution.metadata?.input || {},
        output: execution.metadata?.output || {},
        updatedAt: execution.updatedAt,
      },
      include: { workflow: true },
    });

    return this.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.workflowExecution.delete({
      where: { id },
    });
  }

  private toDomain(data: any): ExecutionEntity {
    return new ExecutionEntity(
      data.id,
      data.workflowId,
      data.userId,
      data.status as ExecutionStatus,
      data.startedAt,
      data.completedAt,
      data.error,
      {
        input: data.input,
        output: data.output,
        nodeExecutions: data.nodeExecutions,
        workflow: data.workflow ? { id: data.workflow.id, name: data.workflow.name } : undefined,
      },
      data.createdAt,
      data.updatedAt,
    );
  }
}
