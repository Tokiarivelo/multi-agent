import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ExecutionEntity, ExecutionStatus } from '../../domain/entities/execution.entity';
import { IExecutionRepository } from '../../domain/repositories/execution.repository.interface';

@Injectable()
export class UpdateExecutionStatusUseCase {
  constructor(
    @Inject(IExecutionRepository)
    private readonly executionRepository: IExecutionRepository,
  ) {}

  async execute(
    executionId: string,
    status: ExecutionStatus,
    error?: string,
  ): Promise<ExecutionEntity> {
    const execution = await this.executionRepository.findById(executionId);
    if (!execution) {
      throw new NotFoundException(`Execution ${executionId} not found`);
    }

    let updatedExecution: ExecutionEntity;

    switch (status) {
      case ExecutionStatus.RUNNING:
        updatedExecution = execution.start();
        break;
      case ExecutionStatus.COMPLETED:
        updatedExecution = execution.complete();
        break;
      case ExecutionStatus.FAILED:
        updatedExecution = execution.fail(error || 'Unknown error');
        break;
      case ExecutionStatus.CANCELLED:
        updatedExecution = execution.cancel();
        break;
      default:
        updatedExecution = execution;
    }

    return this.executionRepository.update(updatedExecution);
  }
}
