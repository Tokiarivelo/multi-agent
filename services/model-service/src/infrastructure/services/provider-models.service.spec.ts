import { ProviderModelsService } from './provider-models.service';
import { ProviderClientFactory } from './provider-client.factory';
import { HttpService } from '@nestjs/axios';
import { ModelProvider } from '../../domain/entities/model.entity';
import { throwError } from 'rxjs';

describe('ProviderModelsService', () => {
  let service: ProviderModelsService;
  let mockHttpService: jest.Mocked<HttpService>;
  let mockClientFactory: jest.Mocked<ProviderClientFactory>;

  beforeEach(() => {
    mockHttpService = {
      get: jest.fn(),
      post: jest.fn(),
    } as unknown as jest.Mocked<HttpService>;

    mockClientFactory = {
      createOpenAIClient: jest.fn(),
      createAnthropicClient: jest.fn(),
      createGoogleClient: jest.fn(),
    } as unknown as jest.Mocked<ProviderClientFactory>;

    service = new ProviderModelsService(mockHttpService, mockClientFactory);
  });

  describe('fetchModels - OpenAI', () => {
    it('should fetch and filter OpenAI chat models', async () => {
      const mockOpenAIClient = {
        models: {
          list: jest.fn().mockResolvedValue({
            data: [
              { id: 'gpt-4' },
              { id: 'gpt-4-turbo' },
              { id: 'gpt-3.5-turbo' },
              { id: 'dall-e-3' }, // Should be filtered out
              { id: 'whisper-1' }, // Should be filtered out
              { id: 'text-embedding-ada-002' }, // Should be filtered out
            ],
          }),
        },
      };
      mockClientFactory.createOpenAIClient.mockReturnValue(mockOpenAIClient as any);

      const result = await service.fetchModels(ModelProvider.OPENAI, 'sk-test');

      expect(result).toHaveLength(3);
      expect(result.every((m) => m.id.startsWith('gpt-'))).toBe(true);
      expect(result.find((m) => m.id === 'dall-e-3')).toBeUndefined();
    });

    it('should return empty array on OpenAI API failure', async () => {
      const mockOpenAIClient = {
        models: {
          list: jest.fn().mockRejectedValue(new Error('API Error')),
        },
      };
      mockClientFactory.createOpenAIClient.mockReturnValue(mockOpenAIClient as any);

      const result = await service.fetchModels(ModelProvider.OPENAI, 'bad-key');

      expect(result).toEqual([]);
    });
  });

  describe('fetchModels - Anthropic', () => {
    it('should return known models when Anthropic API fails', async () => {
      const mockAnthropicClient = {
        models: {
          list: jest.fn().mockRejectedValue(new Error('Anthropic unavailable')),
        },
      };
      mockClientFactory.createAnthropicClient.mockReturnValue(mockAnthropicClient as any);

      const result = await service.fetchModels(ModelProvider.ANTHROPIC, 'sk-ant-test');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((m) => m.id.includes('claude'))).toBe(true);
    });

    it('should return fetched models when Anthropic API succeeds', async () => {
      const mockAnthropicClient = {
        models: {
          list: jest.fn().mockResolvedValue({
            data: [
              { id: 'claude-3-5-sonnet-20241022', display_name: 'Claude 3.5 Sonnet' },
              { id: 'claude-3-haiku-20240307', display_name: 'Claude 3 Haiku' },
            ],
          }),
        },
      };
      mockClientFactory.createAnthropicClient.mockReturnValue(mockAnthropicClient as any);

      const result = await service.fetchModels(ModelProvider.ANTHROPIC, 'sk-ant-test');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Claude 3 Haiku'); // sorted alphabetically
    });
  });

  describe('fetchModels - Google', () => {
    it('should fetch and filter Google generative models', async () => {
      const mockGoogleClient = {
        models: {
          list: jest.fn().mockResolvedValue({
            page: [
              {
                name: 'models/gemini-pro',
                displayName: 'Gemini Pro',
                description: 'A versatile model',
                outputTokenLimit: 8192,
                supportedActions: ['generateContent'],
              },
              {
                name: 'models/embedding-001',
                displayName: 'Embedding',
                supportedActions: ['embedContent'],
              },
            ],
          }),
        },
      };
      mockClientFactory.createGoogleClient.mockReturnValue(mockGoogleClient as any);

      const result = await service.fetchModels(ModelProvider.GOOGLE, 'api-key');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gemini-pro');
      expect(result[0].maxTokens).toBe(8192);
    });

    it('should return empty array on Google API failure', async () => {
      const mockGoogleClient = {
        models: {
          list: jest.fn().mockRejectedValue(new Error('Google unavailable')),
        },
      };
      mockClientFactory.createGoogleClient.mockReturnValue(mockGoogleClient as any);

      const result = await service.fetchModels(ModelProvider.GOOGLE, 'bad-key');

      expect(result).toEqual([]);
    });
  });

  describe('fetchModels - Azure', () => {
    it('should return static Azure models', async () => {
      const result = await service.fetchModels(ModelProvider.AZURE, '');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((m) => m.id.includes('gpt-4'))).toBe(true);
    });
  });

  describe('fetchModels - Ollama', () => {
    it('should return empty array when Ollama is not available', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('Connection refused')));

      const result = await service.fetchModels(ModelProvider.OLLAMA, '');

      expect(result).toEqual([]);
    });
  });
});
