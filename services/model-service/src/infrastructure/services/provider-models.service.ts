import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ModelProvider } from '../../domain/entities/model.entity';
import { firstValueFrom } from 'rxjs';
import { ProviderClientFactory } from './provider-client.factory';

export interface ProviderModel {
  id: string;
  name: string;
  description?: string;
  maxTokens?: number;
  supportsStreaming?: boolean;
}

@Injectable()
export class ProviderModelsService {
  private readonly logger = new Logger(ProviderModelsService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly clientFactory: ProviderClientFactory,
  ) {}

  async fetchModels(provider: ModelProvider, apiKey: string): Promise<ProviderModel[]> {
    try {
      switch (provider) {
        case ModelProvider.OPENAI:
          return await this.fetchOpenAIModels(apiKey);
        case ModelProvider.ANTHROPIC:
          return await this.fetchAnthropicModels(apiKey);
        case ModelProvider.GOOGLE:
          return await this.fetchGoogleModels(apiKey);
        case ModelProvider.AZURE:
          return this.getAzureModels();
        case ModelProvider.OLLAMA:
          return await this.fetchOllamaModels();
        case ModelProvider.CUSTOM:
          return []; // Custom models are entered manually
        default:
          this.logger.warn(`Unsupported provider: ${provider}`);
          return [];
      }
    } catch (error) {
      this.logger.error(`Failed to fetch models for ${provider}: ${error.message}`);
      return [];
    }
  }

  private async fetchOpenAIModels(apiKey: string): Promise<ProviderModel[]> {
    try {
      const client = this.clientFactory.createOpenAIClient(apiKey, 10_000);
      const page = await client.models.list();
      const models = page.data || [];

      // Filter to only chat-completion capable models (gpt-*, o1-*, o3-*, chatgpt-*)
      const chatModels = models.filter((m) => {
        const id = m.id?.toLowerCase() || '';
        return (
          id.startsWith('gpt-') ||
          id.startsWith('o1-') ||
          id.startsWith('o3-') ||
          id.startsWith('o4-') ||
          id.startsWith('chatgpt-')
        );
      });

      return chatModels
        .map((m) => ({
          id: m.id,
          name: m.id,
          description: `OpenAI model: ${m.id}`,
          maxTokens: this.getOpenAIMaxTokens(m.id),
          supportsStreaming: true,
        }))
        .sort((a: ProviderModel, b: ProviderModel) => a.name.localeCompare(b.name));
    } catch (error) {
      this.logger.error(`OpenAI fetchModels failed: ${error.message}`);
      return [];
    }
  }

  private async fetchAnthropicModels(apiKey: string): Promise<ProviderModel[]> {
    try {
      const client = this.clientFactory.createAnthropicClient(apiKey, 10_000);

      const response = await client.models.list({ limit: 100 });
      const models = response.data || [];

      return models
        .map((m) => ({
          id: m.id,
          name: m.display_name || m.id,
          description: `Anthropic model: ${m.display_name || m.id}`,
          maxTokens: this.getAnthropicMaxTokens(m.id),
          supportsStreaming: true,
        }))
        .sort((a: ProviderModel, b: ProviderModel) => a.name.localeCompare(b.name));
    } catch (error) {
      // Fallback: return known Anthropic models if API listing fails
      this.logger.warn(`Anthropic models API failed (${error.message}), returning known models`);
      return this.getKnownAnthropicModels();
    }
  }

  private async fetchGoogleModels(apiKey: string): Promise<ProviderModel[]> {
    try {
      const client = this.clientFactory.createGoogleClient(apiKey);
      const pager = await client.models.list({ config: { pageSize: 100 } });

      const allModels = pager.page || [];

      // Filter to only generative models (those that support generateContent)
      const generativeModels = allModels.filter((m) =>
        m.supportedActions?.includes('generateContent'),
      );

      return generativeModels
        .map((m) => ({
          id: m.name?.replace('models/', '') || m.name || '',
          name: m.displayName || m.name || '',
          description: m.description || `Google model: ${m.displayName}`,
          maxTokens: m.outputTokenLimit || 8192,
          supportsStreaming: true,
        }))
        .sort((a: ProviderModel, b: ProviderModel) => a.name.localeCompare(b.name));
    } catch (error) {
      this.logger.error(`Google fetchModels failed: ${error.message}`);
      return [];
    }
  }

  private getAzureModels(): ProviderModel[] {
    // Azure models depend on deployment, return common ones
    return [
      {
        id: 'gpt-4',
        name: 'GPT-4',
        description: 'Azure OpenAI GPT-4 deployment',
        maxTokens: 8192,
        supportsStreaming: true,
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'Azure OpenAI GPT-4 Turbo deployment',
        maxTokens: 128000,
        supportsStreaming: true,
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Azure OpenAI GPT-4o deployment',
        maxTokens: 128000,
        supportsStreaming: true,
      },
      {
        id: 'gpt-35-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'Azure OpenAI GPT-3.5 Turbo deployment',
        maxTokens: 16384,
        supportsStreaming: true,
      },
    ];
  }

  private async fetchOllamaModels(): Promise<ProviderModel[]> {
    try {
      const ollamaUrl = process.env.OLLAMA_DEFAULT_URL || 'http://localhost:11434';
      const response = await firstValueFrom(
        this.httpService.get(`${ollamaUrl}/api/tags`, {
          timeout: 5000,
        }),
      );

      const models = response.data?.models || [];

      return models.map((m: any) => ({
        id: m.name,
        name: m.name,
        description: `Ollama local model: ${m.name}`,
        maxTokens: 4096,
        supportsStreaming: true,
      }));
    } catch (error) {
      this.logger.warn(`Ollama not available: ${error.message}`);
      return [];
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private getOpenAIMaxTokens(modelId: string): number {
    const id = modelId.toLowerCase();
    if (id.includes('gpt-4o')) return 128000;
    if (id.includes('gpt-4-turbo')) return 128000;
    if (id.includes('gpt-4-32k')) return 32768;
    if (id.includes('gpt-4')) return 8192;
    if (id.includes('gpt-3.5-turbo-16k')) return 16384;
    if (id.includes('gpt-3.5')) return 4096;
    if (id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4')) return 128000;
    return 4096;
  }

  private getAnthropicMaxTokens(modelId: string): number {
    const id = modelId.toLowerCase();
    if (id.includes('claude-3-5') || id.includes('claude-3.5')) return 200000;
    if (id.includes('claude-3-opus')) return 200000;
    if (id.includes('claude-3-sonnet')) return 200000;
    if (id.includes('claude-3-haiku')) return 200000;
    return 100000;
  }

  private getKnownAnthropicModels(): ProviderModel[] {
    return [
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        description: 'Anthropic Claude Sonnet 4',
        maxTokens: 200000,
        supportsStreaming: true,
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: 'Anthropic Claude 3.5 Sonnet (Latest)',
        maxTokens: 200000,
        supportsStreaming: true,
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: 'Anthropic Claude 3.5 Haiku (Fast)',
        maxTokens: 200000,
        supportsStreaming: true,
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Anthropic Claude 3 Opus (Most capable)',
        maxTokens: 200000,
        supportsStreaming: true,
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        description: 'Anthropic Claude 3 Sonnet',
        maxTokens: 200000,
        supportsStreaming: true,
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        description: 'Anthropic Claude 3 Haiku (Fast)',
        maxTokens: 200000,
        supportsStreaming: true,
      },
    ];
  }
}
