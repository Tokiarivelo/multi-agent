import { Injectable, NotFoundException } from '@nestjs/common';
import { ModelRepositoryInterface } from '../../domain/repositories/model.repository.interface';
import { ApiKeyRepositoryInterface } from '../../domain/repositories/api-key.repository.interface';
import { Model } from '../../domain/entities/model.entity';
import { EncryptionService } from '../../infrastructure/services/encryption.service';

@Injectable()
export class GetModelUseCase {
  constructor(
    private readonly modelRepository: ModelRepositoryInterface,
    private readonly apiKeyRepository: ApiKeyRepositoryInterface,
    private readonly encryptionService: EncryptionService,
  ) {}

  private async attachApiKey(model: Model, userId?: string): Promise<Model> {
    if (userId) {
      const apiKeys = await this.apiKeyRepository.findByUserAndProvider(userId, model.provider);
      const activeKey = apiKeys.find((k) => k.isActive && k.isValid);
      if (activeKey) {
        try {
          model.apiKey = this.encryptionService.decrypt(activeKey.encryptedKey);
          await this.apiKeyRepository.updateUsage(activeKey.id);
          return model;
        } catch (e) {
          console.error("Decryption error for user API key in getModelUseCase", e);
        }
      }
    }

    const apiKeyId = model.providerSettings?.apiKeyId;
    if (apiKeyId) {
      try {
        const encryptedKey = await this.apiKeyRepository.getDecryptedKey(apiKeyId);
        model.apiKey = this.encryptionService.decrypt(encryptedKey);
        await this.apiKeyRepository.updateUsage(apiKeyId);
      } catch (e) {
        console.error("Decryption error in getModelUseCase", e);
      }
    }
    return model;
  }

  async execute(id: string, userId?: string): Promise<Model> {
    const model = await this.modelRepository.findById(id);
    if (!model) {
      throw new NotFoundException(`Model with id '${id}' not found`);
    }
    return this.attachApiKey(model, userId);
  }

  async getByName(name: string, userId?: string): Promise<Model> {
    const model = await this.modelRepository.findByName(name);
    if (!model) {
      throw new NotFoundException(`Model with name '${name}' not found`);
    }
    return this.attachApiKey(model, userId);
  }

  async getDefault(userId?: string): Promise<Model> {
    const model = await this.modelRepository.getDefaultModel();
    if (!model) {
      throw new NotFoundException('No default model configured');
    }
    return this.attachApiKey(model, userId);
  }
}
