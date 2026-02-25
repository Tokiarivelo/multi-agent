import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiKeyRepositoryInterface } from '../../domain/repositories/api-key.repository.interface';
import { ModelProvider } from '../../domain/entities/model.entity';
import { EncryptionService } from '../../infrastructure/services/encryption.service';
import {
  ProviderModelsService,
  ProviderModel,
} from '../../infrastructure/services/provider-models.service';

@Injectable()
export class FetchProviderModelsUseCase {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepositoryInterface,
    private readonly encryptionService: EncryptionService,
    private readonly providerModelsService: ProviderModelsService,
  ) {}

  async execute(userId: string, provider: ModelProvider): Promise<ProviderModel[]> {
    // For Ollama, Azure, and Custom, no API key needed
    if (
      provider === ModelProvider.OLLAMA ||
      provider === ModelProvider.AZURE ||
      provider === ModelProvider.CUSTOM
    ) {
      return this.providerModelsService.fetchModels(provider, '');
    }

    // Find the user's active API key for this provider
    const apiKeys = await this.apiKeyRepository.findByUserAndProvider(userId, provider);

    const activeKey = apiKeys.find((k) => k.isActive && k.isValid);

    if (!activeKey) {
      throw new NotFoundException(
        `No valid API key found for provider '${provider}'. Please add an API key first.`,
      );
    }

    // Decrypt the API key
    let decryptedKey: string;
    try {
      decryptedKey = this.encryptionService.decrypt(activeKey.encryptedKey);
    } catch {
      throw new BadRequestException(
        `Failed to decrypt API key for provider '${provider}'. The key may be corrupted.`,
      );
    }

    return this.providerModelsService.fetchModels(provider, decryptedKey);
  }
}
