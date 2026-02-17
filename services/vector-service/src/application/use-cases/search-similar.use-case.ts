import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { IVectorRepository } from '../../domain/repositories/vector.repository.interface';
import { IQdrantClient } from '../interfaces/qdrant.client.interface';
import { EmbeddingService } from '../../domain/services/embedding.service';
import { SearchDto, SearchResultDto } from '../dto/search.dto';

@Injectable()
export class SearchSimilarUseCase {
  private readonly logger = new Logger(SearchSimilarUseCase.name);

  constructor(
    @Inject('IVectorRepository')
    private readonly vectorRepository: IVectorRepository,
    @Inject('IQdrantClient')
    private readonly qdrantClient: IQdrantClient,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async execute(dto: SearchDto): Promise<SearchResultDto[]> {
    this.logger.log(`Searching in collection: ${dto.collectionId}`);

    // Get collection
    const collection = await this.vectorRepository.findCollectionById(dto.collectionId);
    if (!collection) {
      throw new NotFoundException(`Collection '${dto.collectionId}' not found`);
    }

    // Generate embedding from query if not provided
    let embedding = dto.embedding;
    if (!embedding) {
      if (!dto.query) {
        throw new BadRequestException('Either query or embedding must be provided');
      }
      embedding = await this.embeddingService.generateEmbedding(dto.query);
    }

    // Validate embedding dimension
    if (embedding.length !== collection.dimension) {
      throw new BadRequestException(
        `Embedding dimension ${embedding.length} does not match collection dimension ${collection.dimension}`,
      );
    }

    // Search in Qdrant
    const qdrantCollectionName = collection.getQdrantCollectionName();
    const limit = dto.limit || 10;
    const results = await this.qdrantClient.search(
      qdrantCollectionName,
      embedding,
      limit,
      dto.filter,
    );

    // Map results to DTOs
    const searchResults = results.map(
      result =>
        new SearchResultDto(
          result.id,
          result.score,
          result.payload.content as string,
          result.payload.metadata as Record<string, any>,
        ),
    );

    this.logger.log(`Search completed: ${searchResults.length} results found`);
    return searchResults;
  }
}
