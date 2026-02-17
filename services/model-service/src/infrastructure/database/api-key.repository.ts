import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ApiKeyRepositoryInterface, ApiKeyFilters } from '../../domain/repositories/api-key.repository.interface';
import { ApiKey, CreateApiKeyInput, UpdateApiKeyInput, ModelProvider } from '../../domain/entities/api-key.entity';

@Injectable()
export class ApiKeyRepository implements ApiKeyRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateApiKeyInput,
    encryptedKey: string,
    keyPrefix?: string,
  ): Promise<ApiKey> {
    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId: input.userId,
        provider: input.provider,
        keyName: input.keyName,
        encryptedKey,
        keyPrefix,
        metadata: input.metadata,
      },
    });

    return this.mapToEntity(apiKey);
  }

  async findById(id: string): Promise<ApiKey | null> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id },
    });
    return apiKey ? this.mapToEntity(apiKey) : null;
  }

  async findByUserId(userId: string, filters?: ApiKeyFilters): Promise<ApiKey[]> {
    const apiKeys = await this.prisma.apiKey.findMany({
      where: {
        userId,
        ...(filters?.provider && { provider: filters.provider }),
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
        ...(filters?.isValid !== undefined && { isValid: filters.isValid }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiKeys.map(key => this.mapToEntity(key));
  }

  async findByUserAndProvider(userId: string, provider: ModelProvider): Promise<ApiKey[]> {
    const apiKeys = await this.prisma.apiKey.findMany({
      where: { userId, provider },
      orderBy: { createdAt: 'desc' },
    });

    return apiKeys.map(key => this.mapToEntity(key));
  }

  async update(id: string, input: UpdateApiKeyInput): Promise<ApiKey> {
    const apiKey = await this.prisma.apiKey.update({
      where: { id },
      data: {
        ...(input.keyName !== undefined && { keyName: input.keyName }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.metadata !== undefined && { metadata: input.metadata }),
      },
    });

    return this.mapToEntity(apiKey);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.apiKey.delete({
      where: { id },
    });
  }

  async getDecryptedKey(id: string): Promise<string> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id },
      select: { encryptedKey: true },
    });

    if (!apiKey) {
      throw new Error('API key not found');
    }

    return apiKey.encryptedKey;
  }

  async updateUsage(id: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    });
  }

  async validateKeyExists(userId: string, provider: string, keyName: string): Promise<boolean> {
    const count = await this.prisma.apiKey.count({
      where: {
        userId,
        provider: provider as ModelProvider,
        keyName,
      },
    });

    return count > 0;
  }

  private mapToEntity(apiKey: any): ApiKey {
    return {
      id: apiKey.id,
      userId: apiKey.userId,
      provider: apiKey.provider,
      keyName: apiKey.keyName,
      encryptedKey: apiKey.encryptedKey,
      keyPrefix: apiKey.keyPrefix,
      lastUsedAt: apiKey.lastUsedAt,
      usageCount: apiKey.usageCount,
      isActive: apiKey.isActive,
      isValid: apiKey.isValid,
      metadata: apiKey.metadata as Record<string, any>,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt,
    };
  }
}
