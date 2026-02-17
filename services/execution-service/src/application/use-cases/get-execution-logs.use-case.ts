import { Injectable, Inject } from '@nestjs/common';
import { ExecutionLogEntity } from '../../domain/entities/execution-log.entity';
import { IExecutionLogRepository } from '../../domain/repositories/execution-log.repository.interface';

@Injectable()
export class GetExecutionLogsUseCase {
  constructor(
    @Inject(IExecutionLogRepository)
    private readonly executionLogRepository: IExecutionLogRepository,
  ) {}

  async execute(executionId: string): Promise<ExecutionLogEntity[]> {
    return this.executionLogRepository.findByExecutionId(executionId);
  }
}
