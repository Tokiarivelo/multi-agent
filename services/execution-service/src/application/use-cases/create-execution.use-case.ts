import { Injectable, Inject } from '@nestjs/common';
import { ExecutionEntity } from '../../domain/entities/execution.entity';
import { IExecutionRepository } from '../../domain/repositories/execution.repository.interface';
import { CreateExecutionDto } from '../dto/create-execution.dto';

@Injectable()
export class CreateExecutionUseCase {
  constructor(
    @Inject(IExecutionRepository)
    private readonly executionRepository: IExecutionRepository,
  ) {}

  async execute(dto: CreateExecutionDto): Promise<ExecutionEntity> {
    const execution = ExecutionEntity.create({
      id: dto.id,
      workflowId: dto.workflowId,
      userId: dto.userId,
      metadata: dto.metadata,
    });

    return this.executionRepository.create(execution);
  }
}
