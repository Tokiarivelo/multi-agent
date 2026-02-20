import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ExecutionRepository } from '../persistence/execution.repository';
import { ExecutionLogRepository } from '../persistence/execution-log.repository';
import { IExecutionRepository } from '../../domain/repositories/execution.repository.interface';
import { IExecutionLogRepository } from '../../domain/repositories/execution-log.repository.interface';
import { ExecutionDomainService } from '../../domain/services/execution.domain.service';
import { CreateExecutionUseCase } from '../../application/use-cases/create-execution.use-case';
import { UpdateExecutionStatusUseCase } from '../../application/use-cases/update-execution-status.use-case';
import { LogNodeExecutionUseCase } from '../../application/use-cases/log-node-execution.use-case';
import { GetExecutionLogsUseCase } from '../../application/use-cases/get-execution-logs.use-case';

@Module({
  providers: [
    PrismaService,
    // Repositories
    {
      provide: IExecutionRepository,
      useClass: ExecutionRepository,
    },
    {
      provide: IExecutionLogRepository,
      useClass: ExecutionLogRepository,
    },
    // Domain Services
    ExecutionDomainService,
    // Use Cases
    CreateExecutionUseCase,
    UpdateExecutionStatusUseCase,
    LogNodeExecutionUseCase,
    GetExecutionLogsUseCase,
  ],
  exports: [
    CreateExecutionUseCase,
    UpdateExecutionStatusUseCase,
    LogNodeExecutionUseCase,
    GetExecutionLogsUseCase,
    ExecutionDomainService,
    IExecutionRepository,
    IExecutionLogRepository,
    PrismaService,
  ],
})
export class ExecutionModule {}
