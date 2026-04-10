import { Injectable, Logger } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { concat } from '@langchain/core/utils/stream';
import {
  LLMConfig,
  LLMResponse,
  StreamingOptions,
  TokenProgressPayload,
} from '../../../../application/interfaces/langchain-provider.interface';
import { ConversationMessage } from '../../../../domain/entities/agent.entity';

@Injectable()
export class OllamaProvider {
  private readonly logger = new Logger(OllamaProvider.name);
  private model!: ChatOllama;

  async initialize(config: LLMConfig): Promise<void> {
    // ChatOllama uses baseUrl without /v1 — it talks the native Ollama protocol
    const baseUrl =
      config.baseUrl?.replace('/v1', '') ??
      process.env.OLLAMA_BASE_URL ??
      'http://localhost:11434';

    this.model = new ChatOllama({
      model: config.model,
      baseUrl,
      temperature: config.temperature ?? 0.7,
      numPredict: config.maxTokens,
    });

    this.logger.log(`Initialized Ollama provider — model: ${config.model}, baseUrl: ${baseUrl}`);
  }

  async execute(
    messages: ConversationMessage[],
    tools?: any[],
    onProgress?: (progress: TokenProgressPayload) => void,
  ): Promise<LLMResponse> {
    this.logger.log(
      `execute() — onProgress=${onProgress ? 'YES' : 'NO'} tools=${tools?.length ?? 0}`,
    );

    if (onProgress) {
      return this.executeWithProgress(messages, tools, onProgress);
    }

    try {
      const langchainMessages = this.convertMessages(messages);

      let response: any;
      if (tools && tools.length > 0) {
        response = await this.model.bindTools(this.toOllamaTools(tools)).invoke(langchainMessages);
      } else {
        response = await this.model.invoke(langchainMessages);
      }

      const inputTokens: number = response.usage_metadata?.input_tokens ?? 0;
      const outputTokens: number = response.usage_metadata?.output_tokens ?? 0;
      const tokens = inputTokens + outputTokens || this.estimateTokens(response.content?.toString() ?? '');

      this.logger.log(`execute() done — in=${inputTokens} out=${outputTokens} total=${tokens}`);

      return {
        content: response.content?.toString() ?? '',
        tokens,
        inputTokens,
        outputTokens,
        finishReason: response.response_metadata?.done_reason,
        toolCalls: response.tool_calls ?? [],
      };
    } catch (error) {
      this.logger.error(`Ollama execution error: ${error.message}`);
      throw error;
    }
  }

  private async executeWithProgress(
    messages: ConversationMessage[],
    tools: any[] | undefined,
    onProgress: (progress: TokenProgressPayload) => void,
  ): Promise<LLMResponse> {
    try {
      const langchainMessages = this.convertMessages(messages);

      let boundModel: any = this.model;
      if (tools && tools.length > 0) {
        boundModel = this.model.bindTools(this.toOllamaTools(tools));
      }

      const stream = await boundModel.stream(langchainMessages);

      let aggregated: any;
      let chunkCount = 0;

      for await (const chunk of stream) {
        aggregated = aggregated === undefined ? chunk : concat(aggregated, chunk);
        chunkCount++;

        if (chunkCount % 10 === 0) {
          const estOutput = this.estimateTokens(aggregated.content?.toString() ?? '');
          onProgress({ inputTokens: 0, outputTokens: estOutput, totalTokens: estOutput });
        }
      }

      if (!aggregated) {
        return { content: '', tokens: 0, inputTokens: 0, outputTokens: 0 };
      }

      const inputTokens: number = aggregated.usage_metadata?.input_tokens ?? 0;
      const outputTokens: number =
        aggregated.usage_metadata?.output_tokens ??
        this.estimateTokens(aggregated.content?.toString() ?? '');
      const totalTokens = aggregated.usage_metadata?.total_tokens ?? inputTokens + outputTokens;

      this.logger.log(
        `executeWithProgress done — chunks=${chunkCount} in=${inputTokens} out=${outputTokens} total=${totalTokens}`,
      );
      onProgress({ inputTokens, outputTokens, totalTokens });

      return {
        content: aggregated.content?.toString() ?? '',
        tokens: totalTokens,
        inputTokens,
        outputTokens,
        finishReason: aggregated.response_metadata?.done_reason,
        toolCalls: aggregated.tool_calls ?? [],
      };
    } catch (error) {
      this.logger.error(`Ollama streaming-progress error: ${error.message}`);
      throw error;
    }
  }

  async executeStream(
    messages: ConversationMessage[],
    callbacks: StreamingOptions,
    tools?: any[],
  ): Promise<void> {
    try {
      const langchainMessages = this.convertMessages(messages);

      let boundModel: any = this.model;
      if (tools && tools.length > 0) {
        boundModel = this.model.bindTools(this.toOllamaTools(tools));
      }

      const stream = await boundModel.stream(langchainMessages);

      let fullContent = '';
      let tokenCount = 0;

      for await (const chunk of stream) {
        const content = chunk.content?.toString() ?? '';
        if (content) {
          fullContent += content;
          tokenCount = this.estimateTokens(fullContent);
          callbacks.onToken(content);
        }
      }

      callbacks.onComplete({ content: fullContent, tokens: tokenCount });
    } catch (error) {
      this.logger.error(`Ollama streaming error: ${error.message}`);
      callbacks.onError(error);
    }
  }

  // Convert tool definitions to the format Ollama's bindTools expects
  private toOllamaTools(tools: any[]): any[] {
    return tools.map((t) => {
      const fn = t.type === 'function' ? t.function : t;
      let schema = fn.parameters || fn.input_schema;

      if (!schema || Object.keys(schema).length === 0) {
        schema = { type: 'object', properties: {} };
      } else if (!schema.type) {
        schema = { type: 'object', properties: schema.properties || schema };
      }

      return {
        type: 'function',
        function: {
          name: fn.name,
          description: fn.description || `Tool ${fn.name}`,
          parameters: schema,
        },
      };
    });
  }

  private convertMessages(messages: ConversationMessage[]): any[] {
    return messages.map((msg) => {
      switch (msg.role) {
        case 'system':
          return new SystemMessage(msg.content);
        case 'user':
          return new HumanMessage(msg.content);
        case 'assistant': {
          const kwargs: any = { content: msg.content };
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            kwargs.tool_calls = msg.toolCalls;
          }
          return new AIMessage(kwargs);
        }
        case 'tool':
        case 'function':
          return new ToolMessage({
            content: msg.content || '',
            name: msg.name || 'tool',
            tool_call_id: msg.toolCallId || '',
          });
        default:
          return new HumanMessage(msg.content);
      }
    });
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  isSupported(provider: string): boolean {
    return provider?.toLowerCase() === 'ollama';
  }
}
