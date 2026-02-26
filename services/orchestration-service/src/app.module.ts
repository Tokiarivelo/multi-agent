import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

// Infrastructure
import { ConfigModule } from './infrastructure/config/config.module';
import { PrismaService } from './infrastructure/database/prisma.service';
import { WorkflowRepository } from './infrastructure/persistence/workflow.repository';
import { AgentClientService } from './infrastructure/external/agent-client.service';
import { ToolClientService } from './infrastructure/external/tool-client.service';
import { WorkflowExecutorService } from './infrastructure/external/workflow-executor.service';

// Domain
import { WorkflowExecutionService } from './domain/services/workflow-execution.service';
import { WORKFLOW_REPOSITORY } from './domain/repositories/workflow.repository.interface';

// Application
import { CreateWorkflowUseCase } from './application/use-cases/create-workflow.use-case';
import { GetWorkflowUseCase } from './application/use-cases/get-workflow.use-case';
import { ExecuteWorkflowUseCase } from './application/use-cases/execute-workflow.use-case';
import { UpdateWorkflowUseCase } from './application/use-cases/update-workflow.use-case';
import { DeleteWorkflowUseCase } from './application/use-cases/delete-workflow.use-case';
import { WORKFLOW_EXECUTOR } from './application/interfaces/workflow-executor.interface';

// Presentation
import { WorkflowController } from './presentation/controllers/workflow.controller';
import { HealthController } from './presentation/controllers/health.controller';
import { WorkflowGateway } from './presentation/gateways/workflow.gateway';

@Module({
  imports: [
    ConfigModule,
    HttpModule.registerAsync({
      imports: [NestConfigModule],
      useFactory: async () => ({
        timeout: 30000,
        maxRedirects: 5,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [WorkflowController, HealthController],
  providers: [
    PrismaService,
    WorkflowExecutionService,
    AgentClientService,
    ToolClientService,
    WorkflowGateway,

    // Use Cases
    CreateWorkflowUseCase,
    GetWorkflowUseCase,
    ExecuteWorkflowUseCase,
    UpdateWorkflowUseCase,
    DeleteWorkflowUseCase,

    // Repositories
    {
      provide: WORKFLOW_REPOSITORY,
      useClass: WorkflowRepository,
    },

    // Services
    {
      provide: WORKFLOW_EXECUTOR,
      useClass: WorkflowExecutorService,
    },
  ],
})
export class AppModule {}
