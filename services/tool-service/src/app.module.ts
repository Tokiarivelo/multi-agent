import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@infrastructure/config/config.module';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { PrismaToolRepository } from '@infrastructure/persistence/tool.repository';
import { SandboxExecutorService } from '@infrastructure/sandbox/sandbox-executor.service';
import { BuiltInToolsService } from '@infrastructure/sandbox/built-in-tools.service';
import { McpExecutorService } from '@infrastructure/sandbox/mcp-executor.service';
import { ToolController } from '@presentation/controllers/tool.controller';
import { ToolAiController } from '@presentation/controllers/tool-ai.controller';
import { HealthController } from '@presentation/controllers/health.controller';
import { ToolAiService } from '@infrastructure/external/tool-ai.service';
import {
  CreateToolUseCase,
  UpdateToolUseCase,
  DeleteToolUseCase,
  GetToolUseCase,
  ListToolsUseCase,
  ExecuteToolUseCase,
} from '@application/use-cases';

const TOOL_REPOSITORY = 'ToolRepository';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 30,
      },
    ]),
  ],
  controllers: [ToolController, ToolAiController, HealthController],
  providers: [
    PrismaService,
    {
      provide: TOOL_REPOSITORY,
      useClass: PrismaToolRepository,
    },
    SandboxExecutorService,
    BuiltInToolsService,
    McpExecutorService,
    CreateToolUseCase,
    UpdateToolUseCase,
    DeleteToolUseCase,
    GetToolUseCase,
    ListToolsUseCase,
    ExecuteToolUseCase,
    ToolAiService,
  ],
})
export class AppModule {}
