import { Injectable, Logger } from '@nestjs/common';
import { ModelProvider } from '../../domain/entities/model.entity';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ProviderClientFactory } from './provider-client.factory';

@Injectable()
export class ProviderValidatorService {
  private readonly logger = new Logger(ProviderValidatorService.name);

  constructor(private readonly clientFactory: ProviderClientFactory) {}

  async validateApiKey(provider: ModelProvider, apiKey: string): Promise<boolean> {
    try {
      switch (provider) {
        case ModelProvider.OPENAI:
          return await this.validateOpenAI(apiKey);
        case ModelProvider.ANTHROPIC:
          return await this.validateAnthropic(apiKey);
        case ModelProvider.GOOGLE:
          return await this.validateGoogle(apiKey);
        case ModelProvider.AZURE:
          return await this.validateAzure(apiKey);
        case ModelProvider.OLLAMA:
          return this.validateOllama();
        case ModelProvider.CUSTOM:
          return true; // Custom providers skip key validation
        default:
          this.logger.warn(`Unsupported provider: ${provider}`);
          return false;
      }
    } catch (error) {
      this.logger.error(`Validation error for ${provider}: ${error.message}`);
      return false;
    }
  }

  private async validateOpenAI(apiKey: string): Promise<boolean> {
    try {
      const client = this.clientFactory.createOpenAIClient(apiKey, 5000);

      // Use models.list() — a lightweight read-only call to validate the key
      const page = await client.models.list();
      const models = page.data || [];

      return models.length > 0;
    } catch (error) {
      // Authentication error means the key is invalid
      if (error instanceof OpenAI.AuthenticationError) {
        this.logger.debug('OpenAI validation failed: invalid API key');
        return false;
      }
      // Permission error means the key is valid but restricted — key still valid
      if (error instanceof OpenAI.PermissionDeniedError) {
        return true;
      }
      this.logger.debug(`OpenAI validation failed: ${error.message}`);
      return false;
    }
  }

  private async validateAnthropic(apiKey: string): Promise<boolean> {
    try {
      const client = this.clientFactory.createAnthropicClient(apiKey, 5000);

      // Use models.list() — a lightweight read-only call to validate the key
      await client.models.list({ limit: 1 });

      return true;
    } catch (error) {
      // Authentication error means the key is invalid
      if (error instanceof Anthropic.AuthenticationError) {
        this.logger.debug('Anthropic validation failed: invalid API key');
        return false;
      }
      // Permission error means the key is valid but lacks permissions — key still valid
      if (error instanceof Anthropic.PermissionDeniedError) {
        return true;
      }
      this.logger.debug(`Anthropic validation failed: ${error.message}`);
      return false;
    }
  }

  private async validateGoogle(apiKey: string): Promise<boolean> {
    try {
      const client = this.clientFactory.createGoogleClient(apiKey);

      // Use models.list() — a lightweight read-only call to validate the key
      const pager = await client.models.list({ config: { pageSize: 1 } });

      // If we get here without error, the key is valid
      return pager.page.length > 0;
    } catch (error) {
      this.logger.debug(`Google validation failed: ${error.message}`);
      return false;
    }
  }

  private async validateAzure(apiKey: string): Promise<boolean> {
    if (!apiKey || apiKey.length < 10) {
      return false;
    }
    return true;
  }

  private validateOllama(): boolean {
    return true;
  }
}
