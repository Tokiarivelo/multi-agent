import { Injectable, Logger } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
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
export class GoogleProvider {
  private readonly logger = new Logger(GoogleProvider.name);
  private model!: ChatGoogleGenerativeAI;

  async initialize(config: LLMConfig): Promise<void> {
    this.model = new ChatGoogleGenerativeAI({
      model: config.model,
      apiKey: config.apiKey,
      temperature: config.temperature ?? 0.7,
      maxOutputTokens: config.maxTokens,
      streaming: false,
    });

    this.logger.log(`Initialized Google provider with model: ${config.model}`);
  }

  async execute(
    messages: ConversationMessage[],
    tools?: any[],
    onProgress?: (progress: TokenProgressPayload) => void,
  ): Promise<LLMResponse> {
    if (onProgress) {
      return this.executeWithProgress(messages, tools, onProgress);
    }

    try {
      const langchainMessages = this.convertMessages(messages);

      let response: Awaited<ReturnType<typeof this.model.invoke>>;
      if (tools && tools.length > 0) {
        const googleTools = tools.map((t) => {
          const fn = t.type === 'function' ? t.function : t;
          const rawSchema = fn.parameters || fn.input_schema || fn.schema;
          const schema = this.prepareSchema(rawSchema);

          return {
            name: fn.name,
            description: fn.description || `Tool ${fn.name}`,
            schema,
          };
        });
        response = await this.model.bindTools!(googleTools).invoke(langchainMessages);
      } else {
        response = await this.model.invoke(langchainMessages);
      }

      const meta = response.response_metadata as Record<string, any>;
      const usage = meta?.usageMetadata as Record<string, number> | undefined;
      const inputTokens: number = usage?.promptTokenCount ?? 0;
      const outputTokens: number = usage?.candidatesTokenCount ?? 0;
      const tokens =
        usage?.totalTokenCount ||
        inputTokens + outputTokens ||
        this.estimateTokens(response.content.toString());

      return {
        content: response.content.toString(),
        tokens,
        inputTokens,
        outputTokens,
        finishReason: meta?.finishReason as string | undefined,
        toolCalls: response.tool_calls,
      };
    } catch (error) {
      this.logger.error(`Google execution error: ${error.message}`);
      throw error;
    }
  }

  private async executeWithProgress(
    messages: ConversationMessage[],
    tools: any[] | undefined,
    onProgress: (progress: TokenProgressPayload) => void,
  ): Promise<LLMResponse> {
    try {
      const streamingModel = new ChatGoogleGenerativeAI({
        model: (this.model as any).model,
        apiKey: this.model.apiKey,
        temperature: this.model.temperature,
        maxOutputTokens: this.model.maxOutputTokens,
        streaming: true,
      });

      const langchainMessages = this.convertMessages(messages);

      let boundModel: any = streamingModel;
      if (tools && tools.length > 0) {
        const googleTools = tools.map((t) => {
          const fn = t.type === 'function' ? t.function : t;
          const rawSchema = fn.parameters || fn.input_schema || fn.schema;
          return { name: fn.name, description: fn.description || `Tool ${fn.name}`, schema: this.prepareSchema(rawSchema) };
        });
        boundModel = streamingModel.bindTools!(googleTools);
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

      const meta = aggregated.response_metadata as Record<string, any>;
      const usage = meta?.usageMetadata as Record<string, number> | undefined;
      const inputTokens: number = usage?.promptTokenCount ?? 0;
      const outputTokens: number =
        usage?.candidatesTokenCount ?? this.estimateTokens(aggregated.content?.toString() ?? '');
      const totalTokens = usage?.totalTokenCount || inputTokens + outputTokens;

      onProgress({ inputTokens, outputTokens, totalTokens });

      return {
        content: aggregated.content?.toString() ?? '',
        tokens: totalTokens,
        inputTokens,
        outputTokens,
        finishReason: meta?.finishReason as string | undefined,
        toolCalls: aggregated.tool_calls ?? [],
      };
    } catch (error) {
      this.logger.error(`Google streaming-progress error: ${error.message}`);
      throw error;
    }
  }

  async executeStream(
    messages: ConversationMessage[],
    callbacks: StreamingOptions,
    tools?: any[],
  ): Promise<void> {
    try {
      const streamingModel = new ChatGoogleGenerativeAI({
        model: (this.model as any).model,
        apiKey: this.model.apiKey,
        temperature: this.model.temperature,
        maxOutputTokens: this.model.maxOutputTokens,
        streaming: true,
      });

      const langchainMessages = this.convertMessages(messages);

      let fullContent = '';
      let tokenCount = 0;

      let boundModel: any = streamingModel;
      if (tools && tools.length > 0) {
        const googleTools = tools.map((t) => {
          const fn = t.type === 'function' ? t.function : t;
          const rawSchema = fn.parameters || fn.input_schema || fn.schema;
          const schema = this.prepareSchema(rawSchema);

          return {
            name: fn.name,
            description: fn.description || `Tool ${fn.name}`,
            schema,
          };
        });
        boundModel = streamingModel.bindTools!(googleTools);
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
      this.logger.error(`Google streaming error: ${error.message}`);
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
    return provider?.toLowerCase() === 'google';
  }

  private prepareSchema(schema: any): any {
    if (!schema || typeof schema !== 'object') {
      return {
        type: 'object',
        properties: {},
      };
    }

    const result = { ...(schema.properties && !schema.type ? { type: 'object', ...schema } : schema) };

    // Delete unsupported fields
    delete result.additionalProperties;
    delete result.$schema;

    if (result.type === 'array') {
      if (!result.items) {
        result.items = { type: 'string' };
      } else {
        result.items = this.prepareSchema(result.items);
      }
    }

    if (result.type === 'object' && result.properties) {
      const properties: any = {};
      for (const [key, value] of Object.entries(result.properties)) {
        properties[key] = this.prepareSchema(value);
      }
      result.properties = properties;
    }

    // Ensure type is present
    if (!result.type && result.properties) {
      result.type = 'object';
    }

    return result;
  }
}
