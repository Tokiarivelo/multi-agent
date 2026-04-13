import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from './infrastructure/config/config.module';
import { PrismaService } from './infrastructure/database/prisma.service';
import { SeedService } from './infrastructure/database/seed.service';
import { AgentRepository } from './infrastructure/persistence/agent.repository';
import { AGENT_REPOSITORY } from './domain/repositories/agent.repository.interface';
import { AgentExecutionService } from './domain/services/agent-execution.service';
import { CreateAgentUseCase } from './application/use-cases/create-agent.use-case';
import { ListAgentsUseCase } from './application/use-cases/list-agents.use-case';
import { ExecuteAgentUseCase } from './application/use-cases/execute-agent.use-case';
import { GetTokenUsageUseCase } from './application/use-cases/get-token-usage.use-case';
import { TokenUsageRepository } from './infrastructure/persistence/token-usage.repository';
import { LANGCHAIN_PROVIDER } from './application/interfaces/langchain-provider.interface';
import { LangChainService } from './infrastructure/external/langchain/langchain.service';
import { OpenAIProvider } from './infrastructure/external/langchain/providers/openai.provider';
import { AnthropicProvider } from './infrastructure/external/langchain/providers/anthropic.provider';
import { GoogleProvider } from './infrastructure/external/langchain/providers/google.provider';
import { OllamaProvider } from './infrastructure/external/langchain/providers/ollama.provider';
import { ProviderFactory } from './infrastructure/external/langchain/providers/provider.factory';
import { TokenStreamHandler } from './infrastructure/external/langchain/streaming/token-stream.handler';
import { ModelClientService } from './infrastructure/external/model-client.service';
import { ToolClientService } from './infrastructure/external/tool-client.service';
import { VectorClientService } from './infrastructure/external/vector-client.service';
import { AgentController } from './presentation/controllers/agent.controller';
import { HealthController } from './presentation/controllers/health.controller';
import { McpController } from './presentation/controllers/mcp.controller';
import { AgentExecutionGateway } from './presentation/gateways/agent-execution.gateway';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 60000,
      maxRedirects: 5,
    }),
  ],
  controllers: [AgentController, HealthController, McpController],
  providers: [
    PrismaService,
    SeedService,
    {
      provide: AGENT_REPOSITORY,
      useClass: AgentRepository,
    },
    AgentExecutionService,
    CreateAgentUseCase,
    ListAgentsUseCase,
    ExecuteAgentUseCase,
    {
      provide: LANGCHAIN_PROVIDER,
      useClass: LangChainService,
    },
    OpenAIProvider,
    AnthropicProvider,
    GoogleProvider,
    OllamaProvider,
    ProviderFactory,
    TokenStreamHandler,
    ModelClientService,
    ToolClientService,
    VectorClientService,
    AgentExecutionGateway,
    TokenUsageRepository,
    GetTokenUsageUseCase,
  ],
})
export class AppModule {}
