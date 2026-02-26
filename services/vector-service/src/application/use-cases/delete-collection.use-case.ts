import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { IVectorRepository } from '../../domain/repositories/vector.repository.interface';
import { IQdrantClient } from '../interfaces/qdrant.client.interface';

@Injectable()
export class DeleteCollectionUseCase {
  private readonly logger = new Logger(DeleteCollectionUseCase.name);

  constructor(
    @Inject('IVectorRepository')
    private readonly vectorRepository: IVectorRepository,
    @Inject('IQdrantClient')
    private readonly qdrantClient: IQdrantClient,
  ) {}

  async execute(collectionId: string): Promise<void> {
    this.logger.log(`Deleting collection: ${collectionId}`);

    const collection = await this.vectorRepository.findCollectionById(collectionId);
    if (!collection) {
      throw new NotFoundException(`Collection '${collectionId}' not found`);
    }

    const qdrantCollectionName = collection.getQdrantCollectionName();
    const existsInQdrant = await this.qdrantClient.collectionExists(qdrantCollectionName);

    if (existsInQdrant) {
      await this.qdrantClient.deleteCollection(qdrantCollectionName);
      this.logger.log(`Deleted Qdrant collection: ${qdrantCollectionName}`);
    } else {
      this.logger.warn(`Qdrant collection does not exist, skipping delete: ${qdrantCollectionName}`);
    }

    await this.vectorRepository.deleteCollection(collectionId);
    this.logger.log(`Deleted collection metadata: ${collectionId}`);
  }
}
