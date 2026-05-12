import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { loadPrompt } from '../utils/prompt-loader.util';
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
import { VectorClientService } from '../../infrastructure/external/vector-client.service';
import { TokenUsageRepository } from '../../infrastructure/persistence/token-usage.repository';

@Injectable()
export class ExecuteAgentUseCase {
  private readonly logger = new Logger(ExecuteAgentUseCase.name);

  private readonly orchestrationCallbackUrl: string | undefined;

  constructor(
    @Inject(AGENT_REPOSITORY)
    private readonly agentRepository: IAgentRepository,
    @Inject(LANGCHAIN_PROVIDER)
    private readonly langchainProvider: ILangChainProvider,
    private readonly agentExecutionService: AgentExecutionService,
    private readonly modelClient: ModelClientService,
    private readonly toolClient: ToolClientService,
    private readonly vectorClient: VectorClientService,
    private readonly tokenUsageRepository: TokenUsageRepository,
    private readonly configService: ConfigService,
  ) {
    this.orchestrationCallbackUrl = this.configService.get<string>('ORCHESTRATION_CALLBACK_URL');
  }

  /** Fire-and-forget HTTP POST to orchestration so it can push a WebSocket token-update event. */
  private reportTokenProgress(
    executionId: string,
    nodeId: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    totalTokens: number,
    iteration: number,
  ): void {
    if (!this.orchestrationCallbackUrl || !executionId || !nodeId) {
      this.logger.warn(
        `reportTokenProgress skipped — callbackUrl=${this.orchestrationCallbackUrl ?? 'MISSING'} execId=${executionId ?? 'MISSING'} nodeId=${nodeId ?? 'MISSING'}`,
      );
      return;
    }
    this.logger.log(
      `Reporting token progress: execId=${executionId} nodeId=${nodeId} in=${inputTokens} out=${outputTokens} total=${totalTokens} iter=${iteration}`,
    );
    const url = `${this.orchestrationCallbackUrl}/internal/token-progress`;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        executionId,
        nodeId,
        model,
        inputTokens,
        outputTokens,
        totalTokens,
        iteration,
      }),
    }).catch((err) => this.logger.warn(`token-progress POST failed: ${err?.message}`));
  }

  /**
   * Scan tool results for file URLs that the LLM omitted from its response.
   * Appends a download section only when at least one URL is missing.
   */
  private appendMissingFileLinks(
    content: string,
    toolCalls: Array<{ name: string; result: string; error: boolean }>,
  ): string {
    const missing: Array<{ filename: string; url: string }> = [];

    for (const tc of toolCalls) {
      if (tc.error) continue;
      try {
        const parsed: unknown = JSON.parse(tc.result);
        if (
          parsed &&
          typeof parsed === 'object' &&
          'url' in parsed &&
          typeof (parsed as Record<string, unknown>)['url'] === 'string'
        ) {
          const url = (parsed as Record<string, unknown>)['url'] as string;
          if (url && !content.includes(url)) {
            const filename =
              typeof (parsed as Record<string, unknown>)['filename'] === 'string'
                ? ((parsed as Record<string, unknown>)['filename'] as string)
                : 'file';
            missing.push({ filename, url });
          }
        }
      } catch {
        // result is not JSON — skip
      }
    }

    if (missing.length === 0) return content;

    const section =
      `\n\n---\n**Download link${missing.length > 1 ? 's' : ''}:**\n` +
      missing.map((f) => `- [${f.filename}](${f.url})`).join('\n');

    return content + section;
  }

  /** Fire-and-forget HTTP POST to orchestration for real-time thinking/planning stream. */
  private reportThinkingStep(
    executionId: string,
    nodeId: string,
    thinking: {
      step: string;
      thought?: string;
      plan?: string[];
      toolCalls?: any[];
    },
  ): void {
    if (!this.orchestrationCallbackUrl || !executionId || !nodeId) return;

    const url = `${this.orchestrationCallbackUrl}/internal/thinking-step`;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        executionId,
        nodeId,
        ...thinking,
      }),
    }).catch((err) => this.logger.warn(`thinking-step POST failed: ${err?.message}`));
  }

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

  /**
   * Strips base64-encoded binary payloads before they enter LLM context.
   * A base64 blob adds thousands of tokens with zero value — the model cannot
   * parse binary; only extracted text matters.
   *
   * Heuristic: string field > 200 chars consisting solely of base64 characters.
   * Replaced with a sentinel instructing the LLM to call a parser tool instead.
   */
  private sanitizeBinaryData(obj: unknown): unknown {
    if (typeof obj !== 'object' || obj === null) return obj;
    const record = obj as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (
        typeof value === 'string' &&
        value.length > 200 &&
        /^[A-Za-z0-9+/]+=*$/.test(value)
      ) {
        sanitized[key] =
          '[binary content removed — call a document_parse or extract_text tool to read this file]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeBinaryData(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Extract the actual payload from a ToolExecutionResult wrapper.
   * The tool-service wraps every response in { success, data|error, executionTime }.
   * The LLM must receive only the meaningful content.
   */
  private unwrapToolResult(raw: unknown): string {
    const clean = this.sanitizeBinaryData(raw);

    if (typeof clean === 'string') return clean;
    if (clean === null || clean === undefined) return 'null';

    if (typeof clean === 'object') {
      const r = clean as Record<string, unknown>;

      if (r['success'] === false) {
        return `Tool error: ${r['error'] ?? 'Unknown error'}`;
      }

      if ('data' in r) {
        const d = r['data'];
        if (d === null || d === undefined) return 'null';
        return typeof d === 'string' ? d : JSON.stringify(d, null, 2);
      }
    }

    return JSON.stringify(clean, null, 2);
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

      const nodeMetadata = (dto.metadata ?? {}) as Record<string, any>;
      const ragUserId: string = (nodeMetadata.userId as string) ?? '';

      const modelConfig = await this.modelClient.getModelConfig(agent.modelId, ragUserId);

      // Accept both keys: workspacePath (set by AGENT node) and cwd (legacy / direct runs)
      const workspacePath =
        (nodeMetadata.workspacePath as string | undefined) ||
        (nodeMetadata.cwd as string | undefined);

      // Token budget: node override > agent default
      const effectiveMaxTokens =
        nodeMetadata.maxTokens && nodeMetadata.maxTokens > 0
          ? Number(nodeMetadata.maxTokens)
          : agent.maxTokens || 4000;

      const llmConfig: LLMConfig = {
        provider: modelConfig.provider as any,
        model: modelConfig.modelName,
        apiKey: modelConfig.apiKey,
        baseUrl: modelConfig.baseUrl,
        temperature: agent.temperature,
        maxTokens: effectiveMaxTokens,
      };
      await this.langchainProvider.initialize(llmConfig);

      // ── RAG: inject relevant file context before the user message ───────
      // Enabled when metadata.userId + metadata.useVectorSearch are provided.
      // The context block is prepended as a system-level injection to avoid
      // inflating the conversation history and wasting tokens.
      let ragContextBlock = '';
      const useVectorSearch: boolean = Boolean(nodeMetadata.useVectorSearch);
      if (ragUserId && useVectorSearch) {
        const ragResults = await this.vectorClient.searchFiles(ragUserId, dto.input, 5);
        ragContextBlock = this.vectorClient.buildContextBlock(ragResults);
      }

      // ── Build conversation messages ─────────────────────────────────────
      const messages: ConversationMessage[] = [];
      if (dto.conversationHistory) {
        messages.push(
          ...dto.conversationHistory.map((m) => ({ role: m.role, content: m.content })),
        );
      }
      // Prepend file context to the user message when available (single extra message
      // keeps history clean and avoids duplicating context across turns).
      const userContent = ragContextBlock
        ? `${ragContextBlock}\n\nUser request:\n${dto.input}`
        : dto.input;
      messages.push({ role: 'user', content: userContent });

      const workspaceContextBlock = workspacePath
        ? '\n\n[WORKSPACE CONTEXT]\n' + loadPrompt('workspace-context.md', { workspacePath })
        : '';

      // ── Interactive-question protocol — only when allowAskUser is enabled ─
      const allowAskUser = Boolean(nodeMetadata.allowAskUser);
      const askUserRulesBlock = allowAskUser
        ? '\n\n[INTERACTIVE QUESTION PROTOCOL — MANDATORY]\n' + loadPrompt('ask-user-protocol.md')
        : '';

      const fileDownloadRulesBlock =
        '\n\n[FILE DOWNLOAD PROTOCOL — MANDATORY]\n' + loadPrompt('file-download-protocol.md');

      const nodePromptBlock =
        typeof nodeMetadata.nodePrompt === 'string' && nodeMetadata.nodePrompt.trim()
          ? '\n\n[NODE-SPECIFIC INSTRUCTIONS]\n' + nodeMetadata.nodePrompt.trim()
          : '';

      const outputFormat = nodeMetadata.outputFormat as string | undefined;
      const outputTemplate = (nodeMetadata.outputTemplate as string | undefined)?.trim();
      const templateConstraint = outputTemplate
        ? `\n\n[SCHEMA ENFORCEMENT — ABSOLUTE]\nUse EXACTLY these top-level keys and nested keys — no additions, no substitutions, no wrappers:\n${outputTemplate}\nSTRICTLY FORBIDDEN: any key not shown above (e.g. "mails_count", "items", "total", "debug_meta", "metadata", or any other wrapper). Populate the structure with actual data values following the key names shown.`
        : '';
      const outputFormatBlock =
        outputFormat === 'json_array'
          ? `\n\n[OUTPUT FORMAT — CRITICAL — THIS OVERRIDES EVERYTHING]\nYour final message MUST be a raw JSON array and nothing else.\nDO NOT start with "Let me", "I have", "Excellent", "Here is", or any prose.\nDO NOT add explanations before or after the JSON.\nSTART your response with [ and END with ].\nNo markdown, no code fences, no commentary.${templateConstraint}`
          : outputFormat === 'json'
            ? `\n\n[OUTPUT FORMAT — CRITICAL — THIS OVERRIDES EVERYTHING]\nYour final message MUST be a raw JSON object and nothing else.\nDO NOT start with "Let me", "I have", "Excellent", "Here is", or any prose.\nDO NOT add explanations before or after the JSON.\nSTART your response with { and END with }.\nNo markdown, no code fences, no commentary.${templateConstraint}`
            : '';

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

      // ── Tool usage instructions ────────────────────────────────────────
      let toolInstructionsBlock = '';
      if (tools.length > 0) {
        const toolNames = tools.map((t) => t.name || t.function?.name || 'unknown').join(', ');
        toolInstructionsBlock =
          `\n\n[TOOL USAGE — CRITICAL]\n` +
          `You have access to the following tools: ${toolNames}\n\n` +
          `IMPORTANT: You MUST use these tools when they can help answer the user's question or perform the requested action.\n` +
          `- Analyze the user's request carefully\n` +
          `- If a tool can provide the information or perform the action, USE IT — do not fabricate answers\n` +
          `- Call tools proactively; do not ask for permission unless absolutely necessary\n` +
          `- You may call multiple tools if needed to complete the task\n` +
          `- Always use the tool when it's the most accurate way to get information or perform an action\n\n` +
          `DO NOT respond with generic answers if a tool can provide specific, real data.`;
      }

      this.logger.log(
        `[tools] agentToolIds=${JSON.stringify(agentToolIds)} extraToolIds=${JSON.stringify(extraToolIds)} resolved=${tools.length}`,
      );
      if (tools.length > 0) {
        this.logger.log(`[tools] schemas sent to LLM: ${JSON.stringify(tools)}`);
      }

      const context = this.agentExecutionService.buildContext(
        messages,
        // toolInstructionsBlock is placed before outputFormatBlock so tools are emphasized
        // outputFormatBlock is intentionally placed LAST so it is the closest instruction
        // to the model's response — earlier instructions tend to be overridden by later ones.
        (agent.systemPrompt ?? '') +
          nodePromptBlock +
          workspaceContextBlock +
          askUserRulesBlock +
          fileDownloadRulesBlock +
          toolInstructionsBlock +
          outputFormatBlock,
      );
      this.agentExecutionService.validateTokenLimit(
        context.conversationHistory,
        effectiveMaxTokens,
      );

      // ── Execute primary agent ───────────────────────────────────────────
      const execId = nodeMetadata.executionId as string | undefined;
      const execNodeId = nodeMetadata.nodeId as string | undefined;

      let totalTokens = 0;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      this.logger.log(
        `[token-progress] execId=${execId ?? 'MISSING'} nodeId=${execNodeId ?? 'MISSING'} callbackUrl=${this.orchestrationCallbackUrl ?? 'MISSING'}`,
      );

      /** Build a live-streaming progress callback for a given iteration index.
       *  Fires every ~10 LLM chunks; adds the partial output to already-accumulated totals. */
      const makeOnProgress = (iterIndex: number) => {
        if (!execId || !execNodeId) {
          this.logger.warn(`makeOnProgress(${iterIndex}): skipped — execId or nodeId missing`);
          return undefined;
        }
        this.logger.log(
          `makeOnProgress(${iterIndex}): callback registered for execId=${execId} nodeId=${execNodeId}`,
        );
        return (p: { inputTokens: number; outputTokens: number; totalTokens: number }) => {
          this.reportTokenProgress(
            execId,
            execNodeId,
            modelConfig.modelName,
            totalInputTokens + p.inputTokens,
            totalOutputTokens + p.outputTokens,
            totalInputTokens + p.inputTokens + totalOutputTokens + p.outputTokens,
            iterIndex,
          );
        };
      };

      this.reportThinkingStep(execId!, execNodeId!, {
        step: 'planning',
        thought: 'Analyzing request and preparing execution plan...',
      });

      let response = await this.langchainProvider.execute(
        context.conversationHistory,
        tools.length > 0 ? tools : undefined,
        makeOnProgress(0),
      );

      totalTokens = response.tokens ?? 0;
      totalInputTokens = response.inputTokens ?? 0;
      totalOutputTokens = response.outputTokens ?? 0;

      // Final accurate report after iteration 0 completes
      this.reportTokenProgress(
        execId!,
        execNodeId!,
        modelConfig.modelName,
        totalInputTokens,
        totalOutputTokens,
        totalTokens,
        0,
      );

      let iterations = 0;
      const MAX_ITERATIONS = 5;
      let needsGithubAuth = false;
      const allToolCalls: Array<{
        id: string;
        name: string;
        args: unknown;
        result: string;
        error: boolean;
        iteration: number;
      }> = [];

      this.logger.log(
        `[llm-response] finishReason=${response.finishReason} toolCalls=${JSON.stringify(response.toolCalls ?? [])}`,
      );

      while (response.toolCalls && response.toolCalls.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++;

        context.conversationHistory.push({
          role: 'assistant',
          content: response.content || '',
          toolCalls: response.toolCalls,
        });

        this.reportThinkingStep(execId!, execNodeId!, {
          step: `iteration_${iterations}`,
          thought: response.content || 'Executing tools based on reasoning...',
          toolCalls: response.toolCalls.map((tc) => ({ name: tc.name, args: tc.args })),
        });

        for (const toolCall of response.toolCalls) {
          let toolContent: string;
          let isError = false;
          try {
            const raw = await this.toolClient.executeTool(
              toolCall.name,
              toolCall.args,
              ragUserId || undefined,
            );
            toolContent = this.unwrapToolResult(raw);
            if (toolContent === '__GITHUB_AUTH_REQUIRED__') {
              needsGithubAuth = true;
              toolContent = 'GitHub authentication required.';
            }
          } catch (err) {
            isError = true;
            toolContent = `Tool error: ${err instanceof Error ? err.message : String(err)}`;
          }
          this.logger.log(
            `[tool-result] ${toolCall.name} → ${toolContent.slice(0, 200)}${toolContent.length > 200 ? '…' : ''}`,
          );
          allToolCalls.push({
            id: toolCall.id,
            name: toolCall.name,
            args: toolCall.args,
            result: toolContent,
            error: isError,
            iteration: iterations,
          });
          context.conversationHistory.push({
            role: 'tool',
            content: toolContent,
            toolCallId: toolCall.id,
            name: toolCall.name,
          });
          if (needsGithubAuth) break;
        }

        if (needsGithubAuth) break;

        this.agentExecutionService.validateTokenLimit(
          context.conversationHistory,
          effectiveMaxTokens,
        );

        response = await this.langchainProvider.execute(
          context.conversationHistory,
          tools.length > 0 ? tools : undefined,
          makeOnProgress(iterations),
        );
        totalTokens += response.tokens ?? 0;
        totalInputTokens += response.inputTokens ?? 0;
        totalOutputTokens += response.outputTokens ?? 0;
        this.reportTokenProgress(
          execId!,
          execNodeId!,
          modelConfig.modelName,
          totalInputTokens,
          totalOutputTokens,
          totalTokens,
          iterations,
        );
      }

      const githubAuthContent =
        "Pour effectuer cette action, j'accès à votre compte GitHub est requis.\n" +
        '__ASK_USER__:{"question":"Autoriser l\'accès à votre compte GitHub ?","type":"oauth_required","choices":[]}';
      const finalContent = needsGithubAuth
        ? githubAuthContent
        : this.appendMissingFileLinks(response.content ?? '', allToolCalls);
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

          const subModelConfig = await this.modelClient.getModelConfig(
            subAgentEntity.modelId,
            ragUserId,
          );
          await this.langchainProvider.initialize({
            provider: subModelConfig.provider as any,
            model: subModelConfig.modelName,
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
        output: finalContent,
        tokens: totalTokens,
        toolCalls: needsGithubAuth ? [] : allToolCalls,
        subAgentResults,
      });

      const completedExecution = await this.agentRepository.updateExecution(execution.id, {
        output: outputPayload,
        tokens: totalTokens,
        status: ExecutionStatus.COMPLETED,
        completedAt: new Date(),
      });

      this.tokenUsageRepository
        .create({
          userId: ragUserId || (nodeMetadata.userId as string) || 'unknown',
          agentId: agent.id,
          executionId: execution.id,
          workflowId: nodeMetadata.workflowId as string | undefined,
          nodeId: nodeMetadata.nodeId as string | undefined,
          isTest: Boolean(nodeMetadata.isTest),
          model: modelConfig.modelName,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          totalTokens,
          inputPreview: dto.input.slice(0, 500),
          outputPreview: finalContent?.slice(0, 500),
          success: true,
        })
        .catch((err) => this.logger.error('Failed to save token usage', err?.message));

      return completedExecution;
    } catch (error) {
      await this.agentRepository.updateExecution(execution.id, {
        status: ExecutionStatus.FAILED,
        error: error.message,
        completedAt: new Date(),
      });

      const failMeta = (dto.metadata ?? {}) as Record<string, any>;
      this.tokenUsageRepository
        .create({
          userId: failMeta.userId || 'unknown',
          agentId: agent.id,
          executionId: execution.id,
          workflowId: failMeta.workflowId as string | undefined,
          nodeId: failMeta.nodeId as string | undefined,
          isTest: Boolean(failMeta.isTest),
          model: 'unknown',
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          inputPreview: dto.input.slice(0, 500),
          success: false,
          errorMessage: error.message,
        })
        .catch((err) => this.logger.error('Failed to save token usage (error path)', err?.message));

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

      const ragUserId: string = (dto.metadata?.userId as string) ?? '';
      const modelConfig = await this.modelClient.getModelConfig(agent.modelId, ragUserId);

      const llmConfig: LLMConfig = {
        provider: modelConfig.provider as any,
        model: modelConfig.modelName,
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
