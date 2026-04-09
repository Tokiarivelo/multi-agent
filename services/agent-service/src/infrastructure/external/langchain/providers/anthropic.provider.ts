import { Injectable, Logger } from '@nestjs/common';
import { ChatAnthropic } from '@langchain/anthropic';
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
export class AnthropicProvider {
  private readonly logger = new Logger(AnthropicProvider.name);
  private model!: ChatAnthropic;

  async initialize(config: LLMConfig): Promise<void> {
    this.model = new ChatAnthropic({
      modelName: config.model,
      anthropicApiKey: config.apiKey,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
      streaming: false,
    });
    (this.model as any).topP = undefined;
    (this.model as any).topK = undefined;

    this.logger.log(`Initialized Anthropic provider with model: ${config.model}`);
  }

  async execute(
    messages: ConversationMessage[],
    tools?: any[],
    onProgress?: (progress: TokenProgressPayload) => void,
  ): Promise<LLMResponse> {
    this.logger.log(`execute() called — onProgress=${onProgress ? 'YES (streaming)' : 'NO (blocking)'} tools=${tools?.length ?? 0}`);
    if (onProgress) {
      this.logger.log('Entering executeWithProgress (streaming mode)');
      return this.executeWithProgress(messages, tools, onProgress);
    }

    try {
      const langchainMessages = this.convertMessages(messages);

      let response: Awaited<ReturnType<typeof this.model.invoke>>;
      if (tools && tools.length > 0) {
        const anthropicTools = tools.map((t) => {
          const fn = t.type === 'function' ? t.function : t;
          let schema = fn.parameters || fn.input_schema;

          if (!schema || Object.keys(schema).length === 0) {
            schema = {
              type: 'object',
              properties: {},
            };
          } else if (!schema.type) {
            schema = {
              type: 'object',
              properties: schema.properties || schema,
            };
          }

          return {
            name: fn.name,
            description: fn.description || `Tool ${fn.name}`,
            input_schema: schema,
          };
        });
        response = await this.model.bindTools(anthropicTools).invoke(langchainMessages);
      } else {
        response = await this.model.invoke(langchainMessages);
      }

      const usage = response.response_metadata?.usage;
      const inputTokens: number = usage?.input_tokens ?? 0;
      const outputTokens: number = usage?.output_tokens ?? 0;
      const tokens = inputTokens + outputTokens || this.estimateTokens(response.content.toString());

      return {
        content: response.content.toString(),
        tokens,
        inputTokens,
        outputTokens,
        finishReason: response.response_metadata?.stop_reason,
        toolCalls: response.tool_calls,
      };
    } catch (error) {
      this.logger.error(`Anthropic execution error: ${error.message}`);
      throw error;
    }
  }

  private async executeWithProgress(
    messages: ConversationMessage[],
    tools: any[] | undefined,
    onProgress: (progress: TokenProgressPayload) => void,
  ): Promise<LLMResponse> {
    try {
      this.logger.log(`executeWithProgress: starting stream — model=${this.model.modelName} tools=${tools?.length ?? 0}`);
      const streamingModel = new ChatAnthropic({
        modelName: this.model.modelName,
        anthropicApiKey: this.model.anthropicApiKey,
        temperature: this.model.temperature,
        maxTokens: this.model.maxTokens,
        streaming: true,
      });
      (streamingModel as any).topP = undefined;
      (streamingModel as any).topK = undefined;

      const langchainMessages = this.convertMessages(messages);

      let boundModel: any = streamingModel;
      if (tools && tools.length > 0) {
        const anthropicTools = tools.map((t) => {
          const fn = t.type === 'function' ? t.function : t;
          let schema = fn.parameters || fn.input_schema;
          if (!schema || Object.keys(schema).length === 0) {
            schema = { type: 'object', properties: {} };
          } else if (!schema.type) {
            schema = { type: 'object', properties: schema.properties || schema };
          }
          return { name: fn.name, description: fn.description || `Tool ${fn.name}`, input_schema: schema };
        });
        boundModel = streamingModel.bindTools(anthropicTools);
      }

      const stream = await boundModel.stream(langchainMessages);

      let aggregated: any;
      let chunkCount = 0;

      for await (const chunk of stream) {
        aggregated = aggregated === undefined ? chunk : concat(aggregated, chunk);
        chunkCount++;
        if (chunkCount === 1) {
          this.logger.log('executeWithProgress: first chunk received — stream is live');
        }
        if (chunkCount % 10 === 0) {
          const estOutput = this.estimateTokens(aggregated.content?.toString() ?? '');
          this.logger.log(`executeWithProgress: chunk=${chunkCount} estOutput=${estOutput} — calling onProgress`);
          onProgress({ inputTokens: 0, outputTokens: estOutput, totalTokens: estOutput });
        }
      }

      this.logger.log(`executeWithProgress: stream complete — totalChunks=${chunkCount}`);

      if (!aggregated) {
        return { content: '', tokens: 0, inputTokens: 0, outputTokens: 0 };
      }

      const usage = aggregated.response_metadata?.usage;
      const inputTokens: number = usage?.input_tokens ?? 0;
      const outputTokens: number =
        usage?.output_tokens ?? this.estimateTokens(aggregated.content?.toString() ?? '');
      const totalTokens = inputTokens + outputTokens;

      this.logger.log(`executeWithProgress: final tokens — in=${inputTokens} out=${outputTokens} total=${totalTokens}`);
      onProgress({ inputTokens, outputTokens, totalTokens });

      return {
        content: aggregated.content?.toString() ?? '',
        tokens: totalTokens,
        inputTokens,
        outputTokens,
        finishReason: aggregated.response_metadata?.stop_reason,
        toolCalls: aggregated.tool_calls ?? [],
      };
    } catch (error) {
      this.logger.error(`Anthropic streaming-progress error: ${error.message}`);
      throw error;
    }
  }

  async executeStream(
    messages: ConversationMessage[],
    callbacks: StreamingOptions,
    tools?: any[],
  ): Promise<void> {
    try {
      const streamingModel = new ChatAnthropic({
        modelName: this.model.modelName,
        anthropicApiKey: this.model.anthropicApiKey,
        temperature: this.model.temperature,
        maxTokens: this.model.maxTokens,
        streaming: true,
      });
      (streamingModel as any).topP = undefined;
      (streamingModel as any).topK = undefined;

      const langchainMessages = this.convertMessages(messages);

      let fullContent = '';
      let tokenCount = 0;

      let boundModel: any = streamingModel;
      if (tools && tools.length > 0) {
        const anthropicTools = tools.map((t) => {
          const fn = t.type === 'function' ? t.function : t;
          let schema = fn.parameters || fn.input_schema;
          
          if (!schema || Object.keys(schema).length === 0) {
            schema = {
              type: 'object',
              properties: {},
            };
          } else if (!schema.type) {
            schema = {
              type: 'object',
              properties: schema.properties || schema,
            };
          }

          return {
            name: fn.name,
            description: fn.description || `Tool ${fn.name}`,
            input_schema: schema,
          };
        });
        boundModel = streamingModel.bindTools(anthropicTools);
      }

      const stream = await boundModel.stream(langchainMessages);

      for await (const chunk of stream) {
        const content = chunk.content.toString();
        if (content) {
          fullContent += content;
          tokenCount = this.estimateTokens(fullContent);
          callbacks.onToken(content);
        }
      }

      callbacks.onComplete({
        content: fullContent,
        tokens: tokenCount,
      });
    } catch (error) {
      this.logger.error(`Anthropic streaming error: ${error.message}`);
      callbacks.onError(error);
    }
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
    return provider?.toLowerCase() === 'anthropic';
  }
}
