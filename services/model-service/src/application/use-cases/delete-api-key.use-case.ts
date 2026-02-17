import { Injectable, NotFoundException } from '@nestjs/common';
import { ApiKeyRepositoryInterface } from '../../domain/repositories/api-key.repository.interface';

@Injectable()
export class DeleteApiKeyUseCase {
  constructor(private readonly apiKeyRepository: ApiKeyRepositoryInterface) {}

  async execute(id: string): Promise<void> {
    const apiKey = await this.apiKeyRepository.findById(id);
    if (!apiKey) {
      throw new NotFoundException(`API key with id '${id}' not found`);
    }

    await this.apiKeyRepository.delete(id);
  }
}
