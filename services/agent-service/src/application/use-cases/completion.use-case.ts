import { Injectable, Logger } from '@nestjs/common';
import { ModelClientService } from '../../infrastructure/external/model-client.service';
import { ProviderFactory } from '../../infrastructure/external/langchain/providers/provider.factory';
import { ConversationMessage } from '../../domain/entities/agent.entity';
import { CompletionDto } from '../dto/completion.dto';

@Injectable()
export class CompletionUseCase {
  private readonly logger = new Logger(CompletionUseCase.name);

  constructor(
    private readonly modelClientService: ModelClientService,
    private readonly providerFactory: ProviderFactory,
  ) {}

  async execute(dto: CompletionDto): Promise<{ content: string; tokens: number }> {
    this.logger.log(`Running one-shot completion with model ${dto.modelId}`);

    const modelConfig = await this.modelClientService.getModelConfig(dto.modelId, dto.userId);

    console.log('Model config:', modelConfig);

    const llmConfig = {
      provider: modelConfig.provider.toLowerCase() as
        | 'openai'
        | 'anthropic'
        | 'google'
        | 'azure'
        | 'ollama',
      model: modelConfig.modelName,
      apiKey: modelConfig.apiKey ?? '',
      baseUrl: modelConfig.baseUrl,
      maxTokens: dto.maxTokens ?? modelConfig.maxTokens ?? 8192,
    };

    const provider = this.providerFactory.getProvider(llmConfig);
    await provider.initialize(llmConfig);

    const messages: ConversationMessage[] = dto.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const result = await provider.execute(messages, []);
    return { content: result.content, tokens: result.tokens };
  }
}
