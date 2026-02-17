import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { IAgentRepository, AGENT_REPOSITORY } from '../../domain/repositories/agent.repository.interface';
import { ExecuteAgentDto } from '../dto/execute-agent.dto';
import { AgentExecution, ExecutionStatus, ConversationMessage } from '../../domain/entities/agent.entity';
import { AgentExecutionService, StreamCallback } from '../../domain/services/agent-execution.service';
import { ILangChainProvider, LANGCHAIN_PROVIDER, LLMConfig } from '../interfaces/langchain-provider.interface';
import { ModelClientService } from '../../infrastructure/external/model-client.service';
import { ToolClientService } from '../../infrastructure/external/tool-client.service';

@Injectable()
export class ExecuteAgentUseCase {
  constructor(
    @Inject(AGENT_REPOSITORY)
    private readonly agentRepository: IAgentRepository,
    @Inject(LANGCHAIN_PROVIDER)
    private readonly langchainProvider: ILangChainProvider,
    private readonly agentExecutionService: AgentExecutionService,
    private readonly modelClient: ModelClientService,
    private readonly toolClient: ToolClientService,
  ) {}

  async execute(agentId: string, dto: ExecuteAgentDto): Promise<AgentExecution> {
    const agent = await this.agentRepository.findById(agentId);
    
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }

    const execution = await this.agentRepository.createExecution({
      agentId: agent.id,
      input: dto.input,
      status: ExecutionStatus.PENDING,
      startedAt: new Date(),
    });

    try {
      await this.agentRepository.updateExecution(execution.id, {
        status: ExecutionStatus.RUNNING,
      });

      const modelConfig = await this.modelClient.getModelConfig(agent.modelId);
      
      const llmConfig: LLMConfig = {
        provider: modelConfig.provider as any,
        model: modelConfig.name,
        apiKey: modelConfig.apiKey,
        baseUrl: modelConfig.baseUrl,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
      };

      await this.langchainProvider.initialize(llmConfig);

      const messages: ConversationMessage[] = [];
      
      if (dto.conversationHistory) {
        messages.push(...dto.conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
        })));
      }
      
      messages.push({
        role: 'user',
        content: dto.input,
      });

      const context = this.agentExecutionService.buildContext(messages, agent.systemPrompt);
      
      this.agentExecutionService.validateTokenLimit(
        context.conversationHistory,
        agent.maxTokens || 4000,
      );

      let tools = [];
      if (agent.tools && agent.tools.length > 0) {
        tools = await this.toolClient.getTools(agent.tools);
      }

      const response = await this.langchainProvider.execute(
        context.conversationHistory,
        tools.length > 0 ? tools : undefined,
      );

      const completedExecution = await this.agentRepository.updateExecution(execution.id, {
        output: response.content,
        tokens: response.tokens,
        status: ExecutionStatus.COMPLETED,
        completedAt: new Date(),
      });

      return completedExecution;
    } catch (error) {
      await this.agentRepository.updateExecution(execution.id, {
        status: ExecutionStatus.FAILED,
        error: error.message,
        completedAt: new Date(),
      });
      
      throw new BadRequestException(`Agent execution failed: ${error.message}`);
    }
  }

  async executeStream(
    agentId: string,
    dto: ExecuteAgentDto,
    callbacks: StreamCallback,
  ): Promise<void> {
    const agent = await this.agentRepository.findById(agentId);
    
    if (!agent) {
      callbacks.onError(new NotFoundException(`Agent with ID ${agentId} not found`));
      return;
    }

    const execution = await this.agentRepository.createExecution({
      agentId: agent.id,
      input: dto.input,
      status: ExecutionStatus.PENDING,
      startedAt: new Date(),
    });

    try {
      await this.agentRepository.updateExecution(execution.id, {
        status: ExecutionStatus.RUNNING,
      });

      const modelConfig = await this.modelClient.getModelConfig(agent.modelId);
      
      const llmConfig: LLMConfig = {
        provider: modelConfig.provider as any,
        model: modelConfig.name,
        apiKey: modelConfig.apiKey,
        baseUrl: modelConfig.baseUrl,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
      };

      await this.langchainProvider.initialize(llmConfig);

      const messages: ConversationMessage[] = [];
      
      if (dto.conversationHistory) {
        messages.push(...dto.conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
        })));
      }
      
      messages.push({
        role: 'user',
        content: dto.input,
      });

      const context = this.agentExecutionService.buildContext(messages, agent.systemPrompt);

      let tools = [];
      if (agent.tools && agent.tools.length > 0) {
        tools = await this.toolClient.getTools(agent.tools);
      }

      await this.langchainProvider.executeStream(
        context.conversationHistory,
        {
          onToken: callbacks.onToken,
          onComplete: async (response) => {
            await this.agentRepository.updateExecution(execution.id, {
              output: response.content,
              tokens: response.tokens,
              status: ExecutionStatus.COMPLETED,
              completedAt: new Date(),
            });
            
            callbacks.onComplete({
              output: response.content,
              tokens: response.tokens,
            });
          },
          onError: async (error) => {
            await this.agentRepository.updateExecution(execution.id, {
              status: ExecutionStatus.FAILED,
              error: error.message,
              completedAt: new Date(),
            });
            
            callbacks.onError(error);
          },
        },
        tools.length > 0 ? tools : undefined,
      );
    } catch (error) {
      await this.agentRepository.updateExecution(execution.id, {
        status: ExecutionStatus.FAILED,
        error: error.message,
        completedAt: new Date(),
      });
      
      callbacks.onError(error);
    }
  }
}
