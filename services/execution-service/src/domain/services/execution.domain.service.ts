import { Injectable, Inject } from '@nestjs/common';
import { ExecutionEntity } from '../entities/execution.entity';
import { ExecutionLogEntity } from '../entities/execution-log.entity';
import { IExecutionRepository } from '../repositories/execution.repository.interface';
import { IExecutionLogRepository } from '../repositories/execution-log.repository.interface';

@Injectable()
export class ExecutionDomainService {
  constructor(
    @Inject(IExecutionRepository)
    private readonly executionRepository: IExecutionRepository,
    @Inject(IExecutionLogRepository)
    private readonly executionLogRepository: IExecutionLogRepository,
  ) {}

  async getExecutionWithLogs(executionId: string): Promise<{
    execution: ExecutionEntity;
    logs: ExecutionLogEntity[];
  } | null> {
    const execution = await this.executionRepository.findById(executionId);
    if (!execution) {
      return null;
    }

    const result = await this.executionLogRepository.findByExecutionId(executionId, {
      page: 1,
      limit: 1000,
    });
    const logs = result.data;

    return { execution, logs };
  }

  async findFailedNode(executionId: string): Promise<ExecutionLogEntity | null> {
    const result = await this.executionLogRepository.findByExecutionId(executionId, {
      page: 1,
      limit: 1000,
    });
    return result.data.find((log) => log.status === 'FAILED') || null;
  }
}
