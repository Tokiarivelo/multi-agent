import { Injectable, Logger } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import {
  LLMConfig,
  LLMResponse,
  StreamingOptions,
} from '../../../../application/interfaces/langchain-provider.interface';
import { ConversationMessage } from '../../../../domain/entities/agent.entity';

@Injectable()
export class GoogleProvider {
  private readonly logger = new Logger(GoogleProvider.name);
  private model!: ChatGoogleGenerativeAI;

  async initialize(config: LLMConfig): Promise<void> {
    this.model = new ChatGoogleGenerativeAI({
      modelName: config.model,
      apiKey: config.apiKey,
      temperature: config.temperature ?? 0.7,
      maxOutputTokens: config.maxTokens,
      streaming: false,
    });

    this.logger.log(`Initialized Google provider with model: ${config.model}`);
  }

  async execute(messages: ConversationMessage[], tools?: any[]): Promise<LLMResponse> {
    try {
      const langchainMessages = this.convertMessages(messages);

      let response;
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

      const tokens = this.estimateTokens(response.content.toString());

      return {
        content: response.content.toString(),
        tokens,
        finishReason: response.response_metadata?.finishReason,
        toolCalls: response.tool_calls,
      };
    } catch (error) {
      this.logger.error(`Google execution error: ${error.message}`);
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
        modelName: (this.model as any).model,
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
