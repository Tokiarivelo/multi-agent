import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  IAgentRepository,
  AGENT_REPOSITORY,
} from '../../domain/repositories/agent.repository.interface';
import { ExecuteAgentDto } from '../dto/execute-agent.dto';
import {
  AgentExecution,
  ExecutionStatus,
  ConversationMessage,
} from '../../domain/entities/agent.entity';
import {
  AgentExecutionService,
  StreamCallback,
} from '../../domain/services/agent-execution.service';
import {
  ILangChainProvider,
  LANGCHAIN_PROVIDER,
  LLMConfig,
} from '../interfaces/langchain-provider.interface';
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

  // ─── Compact handoff helper ──────────────────────────────────────────────
  /** Summarize a long conversation into a single compact paragraph to save tokens */
  private async compactContext(messages: ConversationMessage[], role: string): Promise<string> {
    const fullText = messages
      .filter((m) => m.role !== 'system')
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');
    return (
      `[Compact handoff to sub-agent: ${role || 'assistant'}]\n` +
      `The following is a condensed summary of the conversation so far.\n` +
      `Original exchange (${messages.length} messages):\n----\n` +
      fullText.slice(0, 2000) + // hard cap against token overflow
      (fullText.length > 2000 ? '\n…[truncated]' : '')
    );
  }

  async execute(agentId: string, dto: ExecuteAgentDto): Promise<AgentExecution> {
    const agent = await this.agentRepository.findById(agentId);
    if (!agent) throw new NotFoundException(`Agent with ID ${agentId} not found`);

    const execution = await this.agentRepository.createExecution({
      agentId: agent.id,
      input: dto.input,
      status: ExecutionStatus.PENDING,
      startedAt: new Date(),
    });

    try {
      await this.agentRepository.updateExecution(execution.id, { status: ExecutionStatus.RUNNING });

      const modelConfig = await this.modelClient.getModelConfig(agent.modelId);
      const nodeMetadata = (dto.metadata ?? {}) as Record<string, any>;

      // Token budget: node override > agent default
      const effectiveMaxTokens =
        nodeMetadata.maxTokens && nodeMetadata.maxTokens > 0
          ? Number(nodeMetadata.maxTokens)
          : agent.maxTokens || 4000;

      const llmConfig: LLMConfig = {
        provider: modelConfig.provider as any,
        model: modelConfig.name,
        apiKey: modelConfig.apiKey,
        baseUrl: modelConfig.baseUrl,
        temperature: agent.temperature,
        maxTokens: effectiveMaxTokens,
      };
      await this.langchainProvider.initialize(llmConfig);

      // ── Build conversation messages ─────────────────────────────────────
      const messages: ConversationMessage[] = [];
      if (dto.conversationHistory) {
        messages.push(
          ...dto.conversationHistory.map((m) => ({ role: m.role, content: m.content })),
        );
      }
      messages.push({ role: 'user', content: dto.input });

      const context = this.agentExecutionService.buildContext(messages, agent.systemPrompt);
      this.agentExecutionService.validateTokenLimit(
        context.conversationHistory,
        effectiveMaxTokens,
      );

      // ── Merge tools: agent's own + node-level extras ────────────────────
      const agentToolIds: string[] = Array.isArray(agent.tools) ? (agent.tools as string[]) : [];
      const extraToolIds: string[] = Array.isArray(nodeMetadata.toolIds)
        ? (nodeMetadata.toolIds as string[])
        : [];
      const allToolIds = [...new Set([...agentToolIds, ...extraToolIds])].filter(Boolean);

      let tools: any[] = [];
      if (allToolIds.length > 0) {
        tools = await this.toolClient.getTools(allToolIds);
      }

      // ── Execute primary agent ───────────────────────────────────────────
      const response = await this.langchainProvider.execute(
        context.conversationHistory,
        tools.length > 0 ? tools : undefined,
      );

      let totalTokens = response.tokens ?? 0;
      const subAgentResults: any[] = [];

      // ── Execute sub-agents ──────────────────────────────────────────────
      const subAgents: Array<{ agentId: string; role?: string; compactHandoff?: boolean }> =
        Array.isArray(nodeMetadata.subAgents) ? nodeMetadata.subAgents : [];

      for (const sa of subAgents) {
        if (!sa.agentId) continue;
        try {
          // Optionally compact the conversation to minimize tokens sent to sub-agent
          let handoffInput: string;
          if (sa.compactHandoff !== false) {
            handoffInput = await this.compactContext(context.conversationHistory, sa.role ?? '');
            handoffInput += `\n\nPrimary agent's answer:\n${response.content}`;
          } else {
            handoffInput = `Context:\n${dto.input}\n\nPrimary agent answer:\n${response.content}`;
          }

          const subAgentEntity = await this.agentRepository.findById(sa.agentId);
          if (!subAgentEntity) {
            subAgentResults.push({ agentId: sa.agentId, error: 'Agent not found' });
            continue;
          }

          const subModelConfig = await this.modelClient.getModelConfig(subAgentEntity.modelId);
          await this.langchainProvider.initialize({
            provider: subModelConfig.provider as any,
            model: subModelConfig.name,
            apiKey: subModelConfig.apiKey,
            baseUrl: subModelConfig.baseUrl,
            temperature: subAgentEntity.temperature,
            maxTokens: subAgentEntity.maxTokens,
          });

          const subMessages: ConversationMessage[] = [];
          if (subAgentEntity.systemPrompt) {
            subMessages.push({ role: 'system', content: subAgentEntity.systemPrompt });
          }
          subMessages.push({ role: 'user', content: handoffInput });

          let subTools: any[] = [];
          const subToolIds: string[] = Array.isArray(subAgentEntity.tools)
            ? (subAgentEntity.tools as string[])
            : [];
          if (subToolIds.length > 0) {
            subTools = await this.toolClient.getTools(subToolIds);
          }

          const subResponse = await this.langchainProvider.execute(
            subMessages,
            subTools.length > 0 ? subTools : undefined,
          );

          totalTokens += subResponse.tokens ?? 0;
          subAgentResults.push({
            agentId: sa.agentId,
            role: sa.role,
            output: subResponse.content,
            tokens: subResponse.tokens,
          });
        } catch (err) {
          subAgentResults.push({
            agentId: sa.agentId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        // Re-initialize primary provider for next iteration
        await this.langchainProvider.initialize(llmConfig);
      }

      // ── Persist and return ──────────────────────────────────────────────
      const outputPayload = JSON.stringify({
        output: response.content,
        tokens: totalTokens,
        toolCalls: response.toolCalls ?? [],
        subAgentResults,
      });

      const completedExecution = await this.agentRepository.updateExecution(execution.id, {
        output: outputPayload,
        tokens: totalTokens,
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
        messages.push(
          ...dto.conversationHistory.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        );
      }

      messages.push({
        role: 'user',
        content: dto.input,
      });

      const context = this.agentExecutionService.buildContext(messages, agent.systemPrompt);

      let tools: any[] = [];
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
