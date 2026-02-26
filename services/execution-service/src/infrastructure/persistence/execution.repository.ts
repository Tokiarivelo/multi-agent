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
    const execution = await this.prisma.execution.findUnique({
      where: { id },
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
      this.prisma.execution.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.execution.count(),
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
    const created = await this.prisma.execution.create({
      data: {
        id: execution.id,
        workflowId: execution.workflowId,
        userId: execution.userId,
        status: execution.status,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        error: execution.error,
        metadata: execution.metadata as any,
      },
    });

    return this.toDomain(created);
  }

  async update(execution: ExecutionEntity): Promise<ExecutionEntity> {
    const updated = await this.prisma.execution.update({
      where: { id: execution.id },
      data: {
        status: execution.status,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        error: execution.error,
        metadata: execution.metadata as any,
        updatedAt: execution.updatedAt,
      },
    });

    return this.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.execution.delete({
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
      data.metadata || {},
      data.createdAt,
      data.updatedAt,
    );
  }
}
