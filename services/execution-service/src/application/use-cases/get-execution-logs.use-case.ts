import { Injectable, Inject } from '@nestjs/common';
import { IExecutionLogRepository } from '../../domain/repositories/execution-log.repository.interface';

@Injectable()
export class GetExecutionLogsUseCase {
  constructor(
    @Inject(IExecutionLogRepository)
    private readonly executionLogRepository: IExecutionLogRepository,
  ) {}

  async execute(executionId: string, page: number = 1, limit: number = 20) {
    return this.executionLogRepository.findByExecutionId(executionId, { page, limit });
  }
}
