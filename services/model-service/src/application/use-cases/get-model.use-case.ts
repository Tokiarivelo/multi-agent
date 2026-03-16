import { Injectable, NotFoundException } from '@nestjs/common';
import { ModelRepositoryInterface } from '../../domain/repositories/model.repository.interface';
import { ApiKeyRepositoryInterface } from '../../domain/repositories/api-key.repository.interface';
import { Model } from '../../domain/entities/model.entity';

@Injectable()
export class GetModelUseCase {
  constructor(
    private readonly modelRepository: ModelRepositoryInterface,
    private readonly apiKeyRepository: ApiKeyRepositoryInterface,
  ) {}

  private async attachApiKey(model: Model): Promise<Model> {
    const apiKeyId = model.providerSettings?.apiKeyId;
    if (apiKeyId) {
      try {
        const decryptedKey = await this.apiKeyRepository.getDecryptedKey(apiKeyId);
        model.apiKey = decryptedKey;
      } catch (e) {
        // Ignoring decryption/fetch errors to not break model fetching entirely
      }
    }
    return model;
  }

  async execute(id: string): Promise<Model> {
    const model = await this.modelRepository.findById(id);
    if (!model) {
      throw new NotFoundException(`Model with id '${id}' not found`);
    }
    return this.attachApiKey(model);
  }

  async getByName(name: string): Promise<Model> {
    const model = await this.modelRepository.findByName(name);
    if (!model) {
      throw new NotFoundException(`Model with name '${name}' not found`);
    }
    return this.attachApiKey(model);
  }

  async getDefault(): Promise<Model> {
    const model = await this.modelRepository.getDefaultModel();
    if (!model) {
      throw new NotFoundException('No default model configured');
    }
    return this.attachApiKey(model);
  }
}
