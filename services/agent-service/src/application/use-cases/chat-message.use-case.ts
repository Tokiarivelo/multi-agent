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
import { WorkflowClientService } from '../../infrastructure/external/workflow-client.service';
import { AgentExecutionService } from '../../domain/services/agent-execution.service';
import { ConversationMessage } from '../../domain/entities/agent.entity';
import { ChatMessage, ChatThinkingStep, ChatToolCall, ChatToolRequest } from '../../domain/entities/chat.entity';
import { SendChatMessageDto } from '../dto/chat.dto';

export interface ChatStreamCallbacks {
  onToken: (token: string) => void;
  onThinking: (step: ChatThinkingStep) => void;
  onWorkflowChoice: (payload: { nodeId: string; prompt: string; choices: string[]; multiSelect: boolean; agentMessage?: string }) => Promise<string>;
  onToolRequest: (payload: ChatToolRequest) => Promise<string[]>;
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
    private readonly workflowClient: WorkflowClientService,
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

    // Workflow path: stream execution progress from orchestration service
    if (session.workflowId) {
      const thinkingSteps: ChatThinkingStep[] = [];
      let outputText = '';

      const executionId = await this.workflowClient.startExecution(
        session.workflowId,
        { message: dto.content, attachments: dto.attachments },
        userId,
      );

      await this.workflowClient.streamExecution(executionId, {
        onNodeRunning: (node) => {
          const step: ChatThinkingStep = { step: 'planning', thought: `Running: ${node.nodeName ?? node.nodeId}` };
          thinkingSteps.push(step);
          callbacks.onThinking(step);
        },
        onNodeCompleted: (node) => {
          const thought = `Completed: ${node.nodeName ?? node.nodeId}`;
          const step: ChatThinkingStep = { step: 'tool_call', thought, toolName: node.nodeName };
          thinkingSteps.push(step);
          callbacks.onThinking(step);

          // AI-type nodes: stream output as tokens
          if (this.workflowClient.isAiNode(node.nodeType) && node.output) {
            const text = this.workflowClient.extractOutputText(node.output);
            outputText = text;
            for (const char of text) callbacks.onToken(char);
          }
        },
        onNodeWaiting: async (node) => {
          const wd = node.waitData ?? {};
          const answer = await callbacks.onWorkflowChoice({
            nodeId: node.nodeId,
            prompt: wd.prompt ?? node.nodeName ?? 'Input required',
            choices: wd.proposals ?? [],
            multiSelect: wd.multiSelect ?? false,
            agentMessage: wd.agentMessage,
          });
          return answer;
        },
        onComplete: (output) => {
          if (!outputText) outputText = this.workflowClient.extractOutputText(output);
        },
        onError: (error) => { callbacks.onError(new Error(error)); },
      });

      const assistantMessage = await this.chatRepository.addMessage({
        sessionId,
        role: 'assistant',
        content: outputText || 'Workflow completed.',
        thinkingSteps: thinkingSteps.length > 0 ? thinkingSteps : undefined,
      });
      callbacks.onComplete(assistantMessage);
      return;
    }

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

    // Proactive tool suggestion when no tools are configured:
    // - on the first message (fresh session), OR
    // - when the session previously used tools but user deselected them
    const isFirstMessage = history.filter((m) => m.role === 'user').length === 1;
    const hadToolCallsInHistory = history.some((m) => m.toolCalls && m.toolCalls.length > 0);
    if (!session.agentId && toolIds.length === 0 && (isFirstMessage || hadToolCallsInHistory)) {
      const catalog = await this.toolClient.listToolsCatalog();
      if (catalog.length > 0) {
        const requestId = `toolsugg-${Date.now()}`;
        const selectedIds = await callbacks.onToolRequest({
          requestId,
          failedToolName: '',
          failedToolArgs: {},
          errorMessage: '',
          availableTools: catalog,
        });
        if (selectedIds.length > 0) {
          await this.chatRepository.updateSession(sessionId, { tools: selectedIds });
          toolIds.push(...selectedIds);
        }
      }
    }

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
        if (response.toolCalls && response.toolCalls.length > 0) {
          await this.processToolCalls(
            response,
            context,
            tools,
            toolIds,
            thinkingSteps,
            allToolCalls,
            callbacks,
            sessionId,
            userId,
            dto.workspacePath,
          );
          // Ask the LLM to summarize the tool results in natural language
          const followUp = await this.langchainProvider.execute(
            context.conversationHistory,
            tools.length > 0 ? tools : undefined,
          );
          fullContent = followUp.content;
          if (fullContent) callbacks.onToken(fullContent);
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
    sessionId: string,
    userId?: string,
    workspacePath?: string,
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
        const raw = await this.toolClient.executeTool(toolCall.name, toolCall.args, userId, workspacePath);
        toolContent = this.formatToolContent(raw);
      } catch (err) {
        isError = true;
        const errMessage = err instanceof Error ? err.message : String(err);

        // Pause and ask user to select appropriate tools from catalog
        const catalog = await this.toolClient.listToolsCatalog();
        const requestId = `toolreq-${Date.now()}-${toolCall.id}`;
        const selectedIds = await callbacks.onToolRequest({
          requestId,
          failedToolName: toolCall.name,
          failedToolArgs: toolCall.args,
          errorMessage: errMessage,
          availableTools: catalog,
        });

        if (selectedIds.length > 0) {
          // Persist new tools to session and add definitions for future turns
          const mergedIds = [...new Set([...toolIds, ...selectedIds])];
          await this.chatRepository.updateSession(sessionId, { tools: mergedIds });
          toolIds.splice(0, toolIds.length, ...mergedIds);
          const newToolDefs = await this.toolClient.getTools(selectedIds);
          tools.push(...newToolDefs);

          const newToolNames = catalog
            .filter((t) => selectedIds.includes(t.id))
            .map((t) => t.name)
            .join(', ');
          toolContent = `Tool '${toolCall.name}' was not available. User has enabled: ${newToolNames}. These tools are now active for future requests.`;
        } else {
          toolContent = `Tool error: ${errMessage}`;
        }
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

  private formatToolContent(raw: unknown): string {
    const str = typeof raw === 'string' ? raw : JSON.stringify(raw);
    try {
      const parsed: any = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const data = parsed?.data ?? parsed;
      const url: string | undefined = data?.url;
      const filename: string | undefined = data?.filename ?? data?.name;
      if (url) {
        const label = filename ?? 'Download file';
        return `${str}\n\nFile link: [${label}](${url})`;
      }
    } catch {}
    return str;
  }
}
