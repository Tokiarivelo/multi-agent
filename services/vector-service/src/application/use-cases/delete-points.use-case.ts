import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { IVectorRepository } from '../../domain/repositories/vector.repository.interface';
import { IQdrantClient } from '../interfaces/qdrant.client.interface';

@Injectable()
export class DeletePointsUseCase {
  private readonly logger = new Logger(DeletePointsUseCase.name);

  constructor(
    @Inject('IVectorRepository')
    private readonly vectorRepository: IVectorRepository,
    @Inject('IQdrantClient')
    private readonly qdrantClient: IQdrantClient,
  ) {}

  /**
   * Deletes points from a collection based on a metadata filter.
   * @param collectionId The internal database ID of the collection.
   * @param filter A key-value map of metadata to match for deletion.
   */
  async execute(collectionId: string, filter: Record<string, any>): Promise<void> {
    this.logger.log(`Deleting points from collection: ${collectionId} with filter: ${JSON.stringify(filter)}`);

    const collection = await this.vectorRepository.findCollectionById(collectionId);
    if (!collection) {
      throw new NotFoundException(`Collection '${collectionId}' not found`);
    }

    const qdrantCollectionName = collection.getQdrantCollectionName();
    const qdrantExists = await this.qdrantClient.collectionExists(qdrantCollectionName);
    
    if (qdrantExists) {
      await this.qdrantClient.deletePoints(qdrantCollectionName, filter);
      this.logger.log(`Points deleted from Qdrant successfully for collection ${qdrantCollectionName}`);
    } else {
      this.logger.warn(`Collection ${qdrantCollectionName} does not exist in Qdrant, skipping point deletion.`);
    }
  }
}
