import { Injectable, Logger } from '@nestjs/common';
import { ILangChainProvider, LLMConfig, LLMResponse, StreamingOptions } from '../../../application/interfaces/langchain-provider.interface';
import { ConversationMessage } from '../../../domain/entities/agent.entity';
import { ProviderFactory } from './providers/provider.factory';

@Injectable()
export class LangChainService implements ILangChainProvider {
  private readonly logger = new Logger(LangChainService.name);
  private currentProvider: any;

  constructor(private readonly providerFactory: ProviderFactory) {}

  async initialize(config: LLMConfig): Promise<void> {
    this.logger.log(`Initializing LangChain with provider: ${config.provider}`);
    
    this.currentProvider = this.providerFactory.getProvider(config);
    await this.currentProvider.initialize(config);
  }

  async execute(messages: ConversationMessage[], tools?: any[]): Promise<LLMResponse> {
    if (!this.currentProvider) {
      throw new Error('Provider not initialized. Call initialize() first.');
    }

    return this.currentProvider.execute(messages, tools);
  }

  async executeStream(
    messages: ConversationMessage[],
    callbacks: StreamingOptions,
    tools?: any[],
  ): Promise<void> {
    if (!this.currentProvider) {
      throw new Error('Provider not initialized. Call initialize() first.');
    }

    return this.currentProvider.executeStream(messages, callbacks, tools);
  }

  isSupported(provider: string): boolean {
    return this.providerFactory.isSupported(provider);
  }
}
