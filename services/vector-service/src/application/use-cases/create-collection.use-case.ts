import { Injectable, Inject, ConflictException, Logger } from '@nestjs/common';
import { Collection } from '../../domain/entities/collection.entity';
import { IVectorRepository } from '../../domain/repositories/vector.repository.interface';
import { IQdrantClient } from '../interfaces/qdrant.client.interface';
import { CreateCollectionDto } from '../dto/create-collection.dto';

@Injectable()
export class CreateCollectionUseCase {
  private readonly logger = new Logger(CreateCollectionUseCase.name);

  constructor(
    @Inject('IVectorRepository')
    private readonly vectorRepository: IVectorRepository,
    @Inject('IQdrantClient')
    private readonly qdrantClient: IQdrantClient,
  ) {}

  async execute(dto: CreateCollectionDto): Promise<Collection> {
    this.logger.log(`Creating collection: ${dto.name} for user: ${dto.userId}`);

    const existing = await this.vectorRepository.findCollectionByNameAndUserId(
      dto.name,
      dto.userId,
    );

    if (existing) {
      throw new ConflictException(
        `Collection '${dto.name}' already exists for user '${dto.userId}'`,
      );
    }

    const collection = Collection.create(
      dto.name,
      dto.userId,
      dto.dimension,
      dto.distance || 'cosine',
      dto.embeddingModelId ?? null,
      dto.apiKeyId ?? null,
    );

    const qdrantCollectionName = collection.getQdrantCollectionName();
    const distanceMap = {
      cosine: 'Cosine' as const,
      euclidean: 'Euclid' as const,
      dot: 'Dot' as const,
    };

    await this.qdrantClient.createCollection(
      qdrantCollectionName,
      dto.dimension,
      distanceMap[dto.distance || 'cosine'],
    );

    const savedCollection = await this.vectorRepository.createCollection(collection);

    this.logger.log(`Collection created: ${savedCollection.id} (model: ${dto.embeddingModelId ?? 'env-default'})`);
    return savedCollection;
  }
}
