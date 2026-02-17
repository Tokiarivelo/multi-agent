import { Injectable, Inject } from '@nestjs/common';
import { ExecutionLogEntity, ExecutionLogStatus } from '../../domain/entities/execution-log.entity';
import { IExecutionLogRepository } from '../../domain/repositories/execution-log.repository.interface';
import { ExecutionLogDto } from '../dto/execution-log.dto';

@Injectable()
export class LogNodeExecutionUseCase {
  constructor(
    @Inject(IExecutionLogRepository)
    private readonly executionLogRepository: IExecutionLogRepository,
  ) {}

  async logStart(dto: ExecutionLogDto): Promise<ExecutionLogEntity> {
    let log = await this.executionLogRepository.findByNodeId(
      dto.executionId,
      dto.nodeId,
    );

    if (!log) {
      log = ExecutionLogEntity.create({
        id: dto.id,
        executionId: dto.executionId,
        nodeId: dto.nodeId,
        nodeName: dto.nodeName,
        input: dto.input,
      });
      log = await this.executionLogRepository.create(log);
    }

    const updatedLog = log.start();
    return this.executionLogRepository.update(updatedLog);
  }

  async logComplete(
    executionId: string,
    nodeId: string,
    output: Record<string, any>,
  ): Promise<ExecutionLogEntity> {
    const log = await this.executionLogRepository.findByNodeId(
      executionId,
      nodeId,
    );

    if (!log) {
      throw new Error(
        `Execution log not found for execution ${executionId} and node ${nodeId}`,
      );
    }

    const updatedLog = log.complete(output);
    return this.executionLogRepository.update(updatedLog);
  }

  async logFailure(
    executionId: string,
    nodeId: string,
    error: string,
  ): Promise<ExecutionLogEntity> {
    const log = await this.executionLogRepository.findByNodeId(
      executionId,
      nodeId,
    );

    if (!log) {
      throw new Error(
        `Execution log not found for execution ${executionId} and node ${nodeId}`,
      );
    }

    const updatedLog = log.fail(error);
    return this.executionLogRepository.update(updatedLog);
  }
}
