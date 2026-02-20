import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  ModelRepositoryInterface,
  ModelFilters,
} from '../../domain/repositories/model.repository.interface';
import {
  Model,
  CreateModelInput,
  UpdateModelInput,
  ModelProvider,
} from '../../domain/entities/model.entity';

@Injectable()
export class ModelRepository implements ModelRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateModelInput): Promise<Model> {
    const model = await this.prisma.model.create({
      data: {
        name: input.name,
        provider: input.provider,
        modelName: input.modelId, // Mapping modelId to legacy modelName field
        modelId: input.modelId,
        description: input.description,
        maxTokens: input.maxTokens || 4096,
        supportsStreaming: input.supportsStreaming ?? true,
        defaultTemperature: input.defaultTemperature,
        rateLimitPerMinute: input.rateLimitPerMinute,
        rateLimitPerHour: input.rateLimitPerHour,
        rateLimitPerDay: input.rateLimitPerDay,
        inputCostPer1kTokens: input.inputCostPer1kTokens,
        outputCostPer1kTokens: input.outputCostPer1kTokens,
        providerSettings: input.providerSettings,
        isActive: input.isActive ?? true,
        isDefault: input.isDefault ?? false,
        metadata: input.metadata,
      },
    });

    return this.mapToEntity(model);
  }

  async findById(id: string): Promise<Model | null> {
    const model = await this.prisma.model.findUnique({
      where: { id },
    });
    return model ? this.mapToEntity(model) : null;
  }

  async findByName(name: string): Promise<Model | null> {
    const model = await this.prisma.model.findUnique({
      where: { name },
    });
    return model ? this.mapToEntity(model) : null;
  }

  async findAll(filters?: ModelFilters): Promise<Model[]> {
    const models = await this.prisma.model.findMany({
      where: {
        ...(filters?.provider && { provider: filters.provider }),
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
        ...(filters?.supportsStreaming !== undefined && {
          supportsStreaming: filters.supportsStreaming,
        }),
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return models.map((model) => this.mapToEntity(model));
  }

  async update(id: string, input: UpdateModelInput): Promise<Model> {
    const model = await this.prisma.model.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.maxTokens !== undefined && { maxTokens: input.maxTokens }),
        ...(input.supportsStreaming !== undefined && {
          supportsStreaming: input.supportsStreaming,
        }),
        ...(input.defaultTemperature !== undefined && {
          defaultTemperature: input.defaultTemperature,
        }),
        ...(input.rateLimitPerMinute !== undefined && {
          rateLimitPerMinute: input.rateLimitPerMinute,
        }),
        ...(input.rateLimitPerHour !== undefined && { rateLimitPerHour: input.rateLimitPerHour }),
        ...(input.rateLimitPerDay !== undefined && { rateLimitPerDay: input.rateLimitPerDay }),
        ...(input.inputCostPer1kTokens !== undefined && {
          inputCostPer1kTokens: input.inputCostPer1kTokens,
        }),
        ...(input.outputCostPer1kTokens !== undefined && {
          outputCostPer1kTokens: input.outputCostPer1kTokens,
        }),
        ...(input.providerSettings !== undefined && { providerSettings: input.providerSettings }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
        ...(input.metadata !== undefined && { metadata: input.metadata }),
      },
    });

    return this.mapToEntity(model);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.model.delete({
      where: { id },
    });
  }

  async findByProvider(provider: ModelProvider): Promise<Model[]> {
    const models = await this.prisma.model.findMany({
      where: { provider },
      orderBy: { createdAt: 'desc' },
    });

    return models.map((model) => this.mapToEntity(model));
  }

  async getDefaultModel(): Promise<Model | null> {
    const model = await this.prisma.model.findFirst({
      where: { isDefault: true, isActive: true },
    });
    return model ? this.mapToEntity(model) : null;
  }

  async setDefaultModel(id: string): Promise<Model> {
    await this.prisma.model.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });

    const model = await this.prisma.model.update({
      where: { id },
      data: { isDefault: true },
    });

    return this.mapToEntity(model);
  }

  private mapToEntity(model: any): Model {
    return {
      id: model.id,
      name: model.name,
      provider: model.provider,
      modelId: model.modelId ?? model.modelName,
      description: model.description,
      maxTokens: model.maxTokens,
      supportsStreaming: model.supportsStreaming,
      defaultTemperature: model.defaultTemperature,
      rateLimitPerMinute: model.rateLimitPerMinute,
      rateLimitPerHour: model.rateLimitPerHour,
      rateLimitPerDay: model.rateLimitPerDay,
      inputCostPer1kTokens: model.inputCostPer1kTokens,
      outputCostPer1kTokens: model.outputCostPer1kTokens,
      providerSettings: model.providerSettings as Record<string, any>,
      isActive: model.isActive,
      isDefault: model.isDefault,
      metadata: model.metadata as Record<string, any>,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }
}
