import { Injectable, Logger } from '@nestjs/common';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import {
  LLMConfig,
  LLMResponse,
  StreamingOptions,
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

  async execute(messages: ConversationMessage[], tools?: any[]): Promise<LLMResponse> {
    try {
      const langchainMessages = this.convertMessages(messages);

      let response;
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

      const tokens = this.estimateTokens(response.content.toString());

      return {
        content: response.content.toString(),
        tokens,
        finishReason: response.response_metadata?.stop_reason,
        toolCalls: response.tool_calls,
      };
    } catch (error) {
      this.logger.error(`Anthropic execution error: ${error.message}`);
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
