import { FetchProviderModelsUseCase } from './fetch-provider-models.use-case';
import { ModelProvider } from '../../domain/entities/model.entity';
import { EncryptionService } from '../../infrastructure/services/encryption.service';
import { ProviderModelsService } from '../../infrastructure/services/provider-models.service';
import { ApiKeyRepositoryInterface } from '../../domain/repositories/api-key.repository.interface';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('FetchProviderModelsUseCase', () => {
  let useCase: FetchProviderModelsUseCase;
  let mockApiKeyRepo: jest.Mocked<ApiKeyRepositoryInterface>;
  let mockEncryptionService: jest.Mocked<EncryptionService>;
  let mockProviderModelsService: jest.Mocked<ProviderModelsService>;

  beforeEach(() => {
    mockApiKeyRepo = {
      findByUserAndProvider: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getDecryptedKey: jest.fn(),
      updateUsage: jest.fn(),
      validateKeyExists: jest.fn(),
    } as jest.Mocked<ApiKeyRepositoryInterface>;

    mockEncryptionService = {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
    } as unknown as jest.Mocked<EncryptionService>;

    mockProviderModelsService = {
      fetchModels: jest.fn(),
    } as unknown as jest.Mocked<ProviderModelsService>;

    useCase = new FetchProviderModelsUseCase(
      mockApiKeyRepo,
      mockEncryptionService,
      mockProviderModelsService,
    );
  });

  it('should fetch models for OLLAMA without requiring an API key', async () => {
    const models = [{ id: 'llama3', name: 'Llama 3', maxTokens: 4096 }];
    mockProviderModelsService.fetchModels.mockResolvedValue(models);

    const result = await useCase.execute('user-1', ModelProvider.OLLAMA);

    expect(result).toEqual(models);
    expect(mockApiKeyRepo.findByUserAndProvider).not.toHaveBeenCalled();
    expect(mockProviderModelsService.fetchModels).toHaveBeenCalledWith(ModelProvider.OLLAMA, '');
  });

  it('should fetch models for AZURE without requiring an API key', async () => {
    const models = [{ id: 'gpt-4', name: 'GPT-4', maxTokens: 8192 }];
    mockProviderModelsService.fetchModels.mockResolvedValue(models);

    const result = await useCase.execute('user-1', ModelProvider.AZURE);

    expect(result).toEqual(models);
    expect(mockApiKeyRepo.findByUserAndProvider).not.toHaveBeenCalled();
  });

  it('should return empty array for CUSTOM without requiring an API key', async () => {
    mockProviderModelsService.fetchModels.mockResolvedValue([]);

    const result = await useCase.execute('user-1', ModelProvider.CUSTOM);

    expect(result).toEqual([]);
    expect(mockApiKeyRepo.findByUserAndProvider).not.toHaveBeenCalled();
    expect(mockProviderModelsService.fetchModels).toHaveBeenCalledWith(ModelProvider.CUSTOM, '');
  });

  it('should throw NotFoundException when no valid API key found for provider', async () => {
    mockApiKeyRepo.findByUserAndProvider.mockResolvedValue([]);

    await expect(useCase.execute('user-1', ModelProvider.OPENAI)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw NotFoundException when keys exist but none are active/valid', async () => {
    mockApiKeyRepo.findByUserAndProvider.mockResolvedValue([
      {
        id: 'key-1',
        userId: 'user-1',
        provider: ModelProvider.OPENAI,
        keyName: 'test',
        encryptedKey: 'encrypted',
        isActive: false,
        isValid: false,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await expect(useCase.execute('user-1', ModelProvider.OPENAI)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should fetch and return models using decrypted API key', async () => {
    const apiKey = {
      id: 'key-1',
      userId: 'user-1',
      provider: ModelProvider.OPENAI,
      keyName: 'my-key',
      encryptedKey: 'encrypted-abc',
      isActive: true,
      isValid: true,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockApiKeyRepo.findByUserAndProvider.mockResolvedValue([apiKey]);
    mockEncryptionService.decrypt.mockReturnValue('sk-real-key');

    const models = [{ id: 'gpt-4', name: 'GPT-4', maxTokens: 8192, supportsStreaming: true }];
    mockProviderModelsService.fetchModels.mockResolvedValue(models);

    const result = await useCase.execute('user-1', ModelProvider.OPENAI);

    expect(mockEncryptionService.decrypt).toHaveBeenCalledWith('encrypted-abc');
    expect(mockProviderModelsService.fetchModels).toHaveBeenCalledWith(
      ModelProvider.OPENAI,
      'sk-real-key',
    );
    expect(result).toEqual(models);
  });

  it('should throw BadRequestException when decryption fails', async () => {
    const apiKey = {
      id: 'key-1',
      userId: 'user-1',
      provider: ModelProvider.OPENAI,
      keyName: 'my-key',
      encryptedKey: 'corrupted',
      isActive: true,
      isValid: true,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockApiKeyRepo.findByUserAndProvider.mockResolvedValue([apiKey]);
    mockEncryptionService.decrypt.mockImplementation(() => {
      throw new Error('decryption failed');
    });

    await expect(useCase.execute('user-1', ModelProvider.OPENAI)).rejects.toThrow(
      BadRequestException,
    );
  });
});
