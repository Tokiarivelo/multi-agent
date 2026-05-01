import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import {
  CHAT_REPOSITORY,
  IChatRepository,
} from '../../domain/repositories/chat.repository.interface';
import {
  AGENT_REPOSITORY,
  IAgentRepository,
} from '../../domain/repositories/agent.repository.interface';
import {
  ILangChainProvider,
  LANGCHAIN_PROVIDER,
  LLMConfig,
  StreamingOptions,
} from '../interfaces/langchain-provider.interface';
import { ModelClientService } from '../../infrastructure/external/model-client.service';
import { ToolClientService } from '../../infrastructure/external/tool-client.service';
import { AgentExecutionService } from '../../domain/services/agent-execution.service';
import { ConversationMessage } from '../../domain/entities/agent.entity';
import { ChatMessage, ChatThinkingStep, ChatToolCall } from '../../domain/entities/chat.entity';
import { SendChatMessageDto } from '../dto/chat.dto';

export interface ChatStreamCallbacks {
  onToken: (token: string) => void;
  onThinking: (step: ChatThinkingStep) => void;
  onComplete: (message: ChatMessage) => void;
  onError: (error: Error) => void;
}

@Injectable()
export class ChatMessageUseCase {
  private readonly logger = new Logger(ChatMessageUseCase.name);

  constructor(
    @Inject(CHAT_REPOSITORY)
    private readonly chatRepository: IChatRepository,
    @Inject(AGENT_REPOSITORY)
    private readonly agentRepository: IAgentRepository,
    @Inject(LANGCHAIN_PROVIDER)
    private readonly langchainProvider: ILangChainProvider,
    private readonly modelClient: ModelClientService,
    private readonly toolClient: ToolClientService,
    private readonly agentExecutionService: AgentExecutionService,
  ) {}

  async getMessages(sessionId: string, userId: string): Promise<ChatMessage[]> {
    const session = await this.chatRepository.findSessionById(sessionId, userId);
    if (!session) throw new NotFoundException(`Chat session ${sessionId} not found`);
    return this.chatRepository.findMessagesBySessionId(sessionId);
  }

  async sendMessage(
    sessionId: string,
    userId: string,
    dto: SendChatMessageDto,
    callbacks: ChatStreamCallbacks,
  ): Promise<void> {
    const session = await this.chatRepository.findSessionById(sessionId, userId);
    if (!session) throw new NotFoundException(`Chat session ${sessionId} not found`);

    // Persist the user message
    await this.chatRepository.addMessage({
      sessionId,
      role: 'user',
      content: dto.content,
      attachments: dto.attachments,
    });

    // Resolve model config: prefer agentId → session modelId
    let modelId = session.modelId;
    let systemPrompt = session.systemPrompt ?? '';
    let toolIds: string[] = Array.isArray(session.tools) ? session.tools : [];

    if (session.agentId) {
      const agent = await this.agentRepository.findById(session.agentId);
      if (!agent) throw new NotFoundException(`Agent ${session.agentId} not found`);
      modelId = agent.modelId;
      systemPrompt = agent.systemPrompt ?? systemPrompt;
      toolIds = Array.isArray(agent.tools) ? (agent.tools as string[]) : toolIds;
    }

    if (!modelId) throw new NotFoundException('No model configured for this session');

    const modelConfig = await this.modelClient.getModelConfig(modelId, userId);

    const llmConfig: LLMConfig = {
      provider: modelConfig.provider as LLMConfig['provider'],
      model: modelConfig.modelName,
      apiKey: modelConfig.apiKey,
      baseUrl: modelConfig.baseUrl,
      maxTokens: modelConfig.maxTokens,
    };
    await this.langchainProvider.initialize(llmConfig);

    // Build conversation history from persisted messages
    const history = await this.chatRepository.findMessagesBySessionId(sessionId);
    const conversationMessages: ConversationMessage[] = history.map((m) => ({
      role: m.role as ConversationMessage['role'],
      content: m.content,
    }));

    const context = this.agentExecutionService.buildContext(conversationMessages, systemPrompt);

    let tools: any[] = [];
    if (toolIds.length > 0) {
      tools = await this.toolClient.getTools(toolIds);
    }

    callbacks.onThinking({ step: 'planning', thought: 'Preparing response...' });

    let fullContent = '';
    const thinkingSteps: ChatThinkingStep[] = [{ step: 'planning', thought: 'Preparing response...' }];
    const allToolCalls: ChatToolCall[] = [];

    const streamCallbacks: StreamingOptions = {
      onToken: (token: string) => {
        fullContent += token;
        callbacks.onToken(token);
      },
      onComplete: async (response) => {
        // Handle tool calls if any
        if (response.toolCalls && response.toolCalls.length > 0) {
          await this.processToolCalls(
            response,
            context,
            tools,
            toolIds,
            thinkingSteps,
            allToolCalls,
            callbacks,
          );
          fullContent = context.conversationHistory[context.conversationHistory.length - 1]?.content ?? fullContent;
        }

        const assistantMessage = await this.chatRepository.addMessage({
          sessionId,
          role: 'assistant',
          content: fullContent || response.content,
          toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
          thinkingSteps: thinkingSteps.length > 0 ? thinkingSteps : undefined,
          tokens: response.tokens,
        });

        callbacks.onComplete(assistantMessage);
      },
      onError: (error: Error) => {
        this.logger.error(`Chat stream error: ${error.message}`);
        callbacks.onError(error);
      },
    };

    await this.langchainProvider.executeStream(
      context.conversationHistory,
      streamCallbacks,
      tools.length > 0 ? tools : undefined,
    );
  }

  private async processToolCalls(
    response: any,
    context: any,
    tools: any[],
    toolIds: string[],
    thinkingSteps: ChatThinkingStep[],
    allToolCalls: ChatToolCall[],
    callbacks: ChatStreamCallbacks,
  ): Promise<void> {
    context.conversationHistory.push({
      role: 'assistant',
      content: response.content || '',
      toolCalls: response.toolCalls,
    });

    const thinkingStep: ChatThinkingStep = {
      step: `tool_execution`,
      thought: response.content || 'Executing tools...',
      toolName: response.toolCalls.map((tc: any) => tc.name).join(', '),
    };
    thinkingSteps.push(thinkingStep);
    callbacks.onThinking(thinkingStep);

    for (const toolCall of response.toolCalls) {
      let toolContent: string;
      let isError = false;
      try {
        const raw = await this.toolClient.executeTool(toolCall.name, toolCall.args);
        toolContent = typeof raw === 'string' ? raw : JSON.stringify(raw);
      } catch (err) {
        isError = true;
        toolContent = `Tool error: ${err instanceof Error ? err.message : String(err)}`;
      }

      allToolCalls.push({
        id: toolCall.id,
        name: toolCall.name,
        args: toolCall.args,
        result: toolContent,
        error: isError,
      });

      context.conversationHistory.push({
        role: 'tool',
        content: toolContent,
        toolCallId: toolCall.id,
        name: toolCall.name,
      });
    }
  }
}
