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

    // Check if collection already exists
    const existing = await this.vectorRepository.findCollectionByNameAndUserId(
      dto.name,
      dto.userId,
    );

    if (existing) {
      throw new ConflictException(
        `Collection '${dto.name}' already exists for user '${dto.userId}'`,
      );
    }

    // Create collection entity
    const collection = Collection.create(
      dto.name,
      dto.userId,
      dto.dimension,
      dto.distance || 'cosine',
    );

    // Create collection in Qdrant
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

    // Save collection metadata to database
    const savedCollection = await this.vectorRepository.createCollection(collection);

    this.logger.log(`Collection created successfully: ${savedCollection.id}`);
    return savedCollection;
  }
}
