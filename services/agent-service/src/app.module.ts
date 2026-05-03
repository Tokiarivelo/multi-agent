import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { LANGCHAIN_PROVIDER } from './application/interfaces/langchain-provider.interface';
import { CompletionUseCase } from './application/use-cases/completion.use-case';
import { CreateAgentUseCase } from './application/use-cases/create-agent.use-case';
import { ExecuteAgentUseCase } from './application/use-cases/execute-agent.use-case';
import { GetTokenUsageUseCase } from './application/use-cases/get-token-usage.use-case';
import { ListAgentsUseCase } from './application/use-cases/list-agents.use-case';
import { AGENT_REPOSITORY } from './domain/repositories/agent.repository.interface';
import { AgentExecutionService } from './domain/services/agent-execution.service';
import { ConfigModule } from './infrastructure/config/config.module';
import { PrismaService } from './infrastructure/database/prisma.service';
import { SeedService } from './infrastructure/database/seed.service';
import { LangChainService } from './infrastructure/external/langchain/langchain.service';
import { AnthropicProvider } from './infrastructure/external/langchain/providers/anthropic.provider';
import { GoogleProvider } from './infrastructure/external/langchain/providers/google.provider';
import { OllamaProvider } from './infrastructure/external/langchain/providers/ollama.provider';
import { OpenAIProvider } from './infrastructure/external/langchain/providers/openai.provider';
import { ProviderFactory } from './infrastructure/external/langchain/providers/provider.factory';
import { TokenStreamHandler } from './infrastructure/external/langchain/streaming/token-stream.handler';
import { ModelClientService } from './infrastructure/external/model-client.service';
import { ToolClientService } from './infrastructure/external/tool-client.service';
import { WorkflowClientService } from './infrastructure/external/workflow-client.service';
import { VectorClientService } from './infrastructure/external/vector-client.service';
import { AgentRepository } from './infrastructure/persistence/agent.repository';
import { ChatRepository } from './infrastructure/persistence/chat.repository';
import { TokenUsageRepository } from './infrastructure/persistence/token-usage.repository';
import { AgentController } from './presentation/controllers/agent.controller';
import { AgentAiController } from './presentation/controllers/agent-ai.controller';
import { ChatController } from './presentation/controllers/chat.controller';
import { CompletionController } from './presentation/controllers/completion.controller';
import { HealthController } from './presentation/controllers/health.controller';
import { McpController } from './presentation/controllers/mcp.controller';
import { AgentAiService } from './infrastructure/external/agent-ai.service';
import { AgentExecutionGateway } from './presentation/gateways/agent-execution.gateway';
import { ChatGateway } from './presentation/gateways/chat.gateway';
import { CHAT_REPOSITORY } from './domain/repositories/chat.repository.interface';
import { ChatSessionUseCase } from './application/use-cases/chat-session.use-case';
import { ChatMessageUseCase } from './application/use-cases/chat-message.use-case';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 60000,
      maxRedirects: 5,
    }),
  ],
  controllers: [AgentController, AgentAiController, ChatController, CompletionController, HealthController, McpController],
  providers: [
    PrismaService,
    SeedService,
    {
      provide: AGENT_REPOSITORY,
      useClass: AgentRepository,
    },
    {
      provide: CHAT_REPOSITORY,
      useClass: ChatRepository,
    },
    ChatSessionUseCase,
    ChatMessageUseCase,
    ChatGateway,
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
    WorkflowClientService,
    VectorClientService,
    AgentExecutionGateway,
    TokenUsageRepository,
    GetTokenUsageUseCase,
    CompletionUseCase,
    AgentAiService,
  ],
})
export class AppModule {}
