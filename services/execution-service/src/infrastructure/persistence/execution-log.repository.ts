import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { IExecutionLogRepository } from '../../domain/repositories/execution-log.repository.interface';
import { ExecutionLogEntity, ExecutionLogStatus } from '../../domain/entities/execution-log.entity';

@Injectable()
export class ExecutionLogRepository implements IExecutionLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ExecutionLogEntity | null> {
    const log = await this.prisma.executionLog.findUnique({
      where: { id },
    });

    if (!log) {
      return null;
    }

    return this.toDomain(log);
  }

  async findByExecutionId(executionId: string): Promise<ExecutionLogEntity[]> {
    const logs = await this.prisma.executionLog.findMany({
      where: { executionId },
      orderBy: { startedAt: 'asc' },
    });

    return logs.map((log) => this.toDomain(log));
  }

  async findByNodeId(executionId: string, nodeId: string): Promise<ExecutionLogEntity | null> {
    const log = await this.prisma.executionLog.findFirst({
      where: {
        executionId,
        nodeId,
      },
    });

    if (!log) {
      return null;
    }

    return this.toDomain(log);
  }

  async create(log: ExecutionLogEntity): Promise<ExecutionLogEntity> {
    const created = await this.prisma.executionLog.create({
      data: {
        id: log.id,
        executionId: log.executionId,
        nodeId: log.nodeId,
        nodeName: log.nodeName,
        status: log.status,
        input: log.input as any,
        output: log.output as any,
        error: log.error,
        startedAt: log.startedAt,
        completedAt: log.completedAt,
        duration: log.duration,
      },
    });

    return this.toDomain(created);
  }

  async update(log: ExecutionLogEntity): Promise<ExecutionLogEntity> {
    const updated = await this.prisma.executionLog.update({
      where: { id: log.id },
      data: {
        status: log.status,
        input: log.input as any,
        output: log.output as any,
        error: log.error,
        startedAt: log.startedAt,
        completedAt: log.completedAt,
        duration: log.duration,
        updatedAt: log.updatedAt,
      },
    });

    return this.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.executionLog.delete({
      where: { id },
    });
  }

  private toDomain(data: any): ExecutionLogEntity {
    return new ExecutionLogEntity(
      data.id,
      data.executionId,
      data.nodeId,
      data.nodeName,
      data.status as ExecutionLogStatus,
      data.input || null,
      data.output || null,
      data.error,
      data.startedAt,
      data.completedAt,
      data.duration,
      data.createdAt,
      data.updatedAt,
    );
  }
}
