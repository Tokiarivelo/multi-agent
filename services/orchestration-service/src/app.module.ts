import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';

// Infrastructure
import { ConfigModule } from './infrastructure/config/config.module';
import { PrismaService } from './infrastructure/database/prisma.service';
import { WorkflowRepository } from './infrastructure/persistence/workflow.repository';
import {
  WorkflowCollaboratorRepository,
  WorkflowInvitationRepository,
  WorkflowAccessRequestRepository,
  WorkflowChangeLogRepository,
} from './infrastructure/persistence/workflow-collaboration.repository';
import { AgentClientService } from './infrastructure/external/agent-client.service';
import { ToolClientService } from './infrastructure/external/tool-client.service';
import { WorkflowExecutorService } from './infrastructure/external/workflow-executor.service';
import { WorkflowNotificationService } from './infrastructure/external/workflow-notification.service';

// Domain
import { WorkflowExecutionService } from './domain/services/workflow-execution.service';
import { WORKFLOW_REPOSITORY } from './domain/repositories/workflow.repository.interface';
import {
  WORKFLOW_COLLABORATOR_REPOSITORY,
  WORKFLOW_INVITATION_REPOSITORY,
  WORKFLOW_ACCESS_REQUEST_REPOSITORY,
  WORKFLOW_CHANGE_LOG_REPOSITORY,
} from './domain/repositories/workflow-collaboration.repository.interface';

// Application
import { CreateWorkflowUseCase } from './application/use-cases/create-workflow.use-case';
import { GetWorkflowUseCase } from './application/use-cases/get-workflow.use-case';
import { ExecuteWorkflowUseCase } from './application/use-cases/execute-workflow.use-case';
import { UpdateWorkflowUseCase } from './application/use-cases/update-workflow.use-case';
import { DeleteWorkflowUseCase } from './application/use-cases/delete-workflow.use-case';
import { GetWorkflowExecutionsUseCase } from './application/use-cases/get-workflow-executions.use-case';
import { InviteCollaboratorUseCase } from './application/use-cases/invite-collaborator.use-case';
import { ManageInvitationUseCase } from './application/use-cases/manage-invitation.use-case';
import { ManageAccessRequestUseCase } from './application/use-cases/manage-access-request.use-case';
import { ForkWorkflowUseCase } from './application/use-cases/fork-workflow.use-case';
import { ForkRequestUseCase } from './application/use-cases/fork-request.use-case';
import { WorkflowChangeLogUseCase } from './application/use-cases/workflow-change-log.use-case';
import { ManageWorkflowSharingUseCase } from './application/use-cases/manage-workflow-sharing.use-case';
import { WORKFLOW_EXECUTOR } from './application/interfaces/workflow-executor.interface';

// Presentation
import { WorkflowController } from './presentation/controllers/workflow.controller';
import { WorkflowSharingController } from './presentation/controllers/workflow-sharing.controller';
import { NotificationController } from './presentation/controllers/notification.controller';
import { WorkspaceController } from './presentation/controllers/workspace.controller';
import { HealthController } from './presentation/controllers/health.controller';
import { InternalController } from './presentation/controllers/internal.controller';
import { WorkflowGateway } from './presentation/gateways/workflow.gateway';
import { WorkflowAiController } from './presentation/controllers/workflow-ai.controller';
import { WorkflowRoleGuard } from './presentation/guards/workflow-role.guard';
import { WorkflowAiService } from './infrastructure/external/workflow-ai.service';
import { ResourceProvisioningService } from './infrastructure/external/resource-provisioning.service';
import { WorkflowHealingService } from './infrastructure/external/workflow-healing.service';
import { HealingController } from './presentation/controllers/healing.controller';
import { GmailWebhookController } from './presentation/controllers/gmail-webhook.controller';
import { GmailTriggerService } from './domain/services/gmail-trigger.service';
import { GmailPollerService } from './domain/services/gmail-poller.service';
import { GmailNotificationProcessorService } from './domain/services/gmail-notification-processor.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
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
  controllers: [
    WorkflowSharingController, // must be before WorkflowController — static routes (/public, /invitations/*) must register before :id
    WorkflowController,
    WorkflowAiController,
    NotificationController,
    WorkspaceController,
    HealthController,
    InternalController,
    HealingController,
    GmailWebhookController,
  ],
  providers: [
    PrismaService,
    WorkflowExecutionService,
    AgentClientService,
    ToolClientService,
    WorkflowAiService,
    ResourceProvisioningService,
    WorkflowHealingService,
    WorkflowNotificationService,
    WorkflowGateway,
    GmailPollerService,
    GmailTriggerService,
    GmailNotificationProcessorService,

    // Use Cases
    CreateWorkflowUseCase,
    GetWorkflowUseCase,
    ExecuteWorkflowUseCase,
    UpdateWorkflowUseCase,
    DeleteWorkflowUseCase,
    GetWorkflowExecutionsUseCase,
    InviteCollaboratorUseCase,
    ManageInvitationUseCase,
    ManageAccessRequestUseCase,
    ForkWorkflowUseCase,
    ForkRequestUseCase,
    WorkflowChangeLogUseCase,
    ManageWorkflowSharingUseCase,

    // Repositories
    {
      provide: WORKFLOW_REPOSITORY,
      useClass: WorkflowRepository,
    },
    {
      provide: WORKFLOW_COLLABORATOR_REPOSITORY,
      useClass: WorkflowCollaboratorRepository,
    },
    {
      provide: WORKFLOW_INVITATION_REPOSITORY,
      useClass: WorkflowInvitationRepository,
    },
    {
      provide: WORKFLOW_ACCESS_REQUEST_REPOSITORY,
      useClass: WorkflowAccessRequestRepository,
    },
    {
      provide: WORKFLOW_CHANGE_LOG_REPOSITORY,
      useClass: WorkflowChangeLogRepository,
    },

    WorkflowRoleGuard,

    // Services
    {
      provide: WORKFLOW_EXECUTOR,
      useClass: WorkflowExecutorService,
    },
  ],
})
export class AppModule {}
