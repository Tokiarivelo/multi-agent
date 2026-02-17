import { Module } from '@nestjs/common';
import { ConfigModule } from './infrastructure/config/config.module';
import { NatsModule } from './infrastructure/messaging/nats.module';
import { PrismaService } from './infrastructure/database/prisma.service';
import { ExecutionRepository } from './infrastructure/persistence/execution.repository';
import { ExecutionLogRepository } from './infrastructure/persistence/execution-log.repository';
import { IExecutionRepository } from './domain/repositories/execution.repository.interface';
import { IExecutionLogRepository } from './domain/repositories/execution-log.repository.interface';
import { ExecutionDomainService } from './domain/services/execution.domain.service';
import { CreateExecutionUseCase } from './application/use-cases/create-execution.use-case';
import { UpdateExecutionStatusUseCase } from './application/use-cases/update-execution-status.use-case';
import { LogNodeExecutionUseCase } from './application/use-cases/log-node-execution.use-case';
import { GetExecutionLogsUseCase } from './application/use-cases/get-execution-logs.use-case';
import { ExecutionController } from './presentation/controllers/execution.controller';
import { HealthController } from './presentation/controllers/health.controller';

@Module({
  imports: [ConfigModule, NatsModule],
  controllers: [ExecutionController, HealthController],
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
})
export class AppModule {}
