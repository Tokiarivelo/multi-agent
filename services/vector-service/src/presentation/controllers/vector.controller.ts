import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { CreateCollectionUseCase } from '../../application/use-cases/create-collection.use-case';
import { UpsertDocumentUseCase } from '../../application/use-cases/upsert-document.use-case';
import { SearchSimilarUseCase } from '../../application/use-cases/search-similar.use-case';
import { DeleteCollectionUseCase } from '../../application/use-cases/delete-collection.use-case';
import { CreateCollectionDto } from '../../application/dto/create-collection.dto';
import { UpsertDocumentDto, UpsertDocumentsDto } from '../../application/dto/upsert-document.dto';
import { SearchDto } from '../../application/dto/search.dto';
import { IVectorRepository } from '../../domain/repositories/vector.repository.interface';
import { Inject } from '@nestjs/common';

@Controller('vectors')
export class VectorController {
  private readonly logger = new Logger(VectorController.name);

  constructor(
    private readonly createCollectionUseCase: CreateCollectionUseCase,
    private readonly upsertDocumentUseCase: UpsertDocumentUseCase,
    private readonly searchSimilarUseCase: SearchSimilarUseCase,
    private readonly deleteCollectionUseCase: DeleteCollectionUseCase,
    @Inject('IVectorRepository')
    private readonly vectorRepository: IVectorRepository,
  ) {}

  @Post('collections')
  @HttpCode(HttpStatus.CREATED)
  async createCollection(@Body() dto: CreateCollectionDto) {
    this.logger.log(`POST /vectors/collections - Creating collection: ${dto.name}`);
    const collection = await this.createCollectionUseCase.execute(dto);
    return {
      id: collection.id,
      name: collection.name,
      userId: collection.userId,
      dimension: collection.dimension,
      distance: collection.distance,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    };
  }

  @Get('collections')
  async listCollections(
    @Query('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limitArg?: string,
    @Query('pageSize') pageSizeArg?: string,
  ) {
    this.logger.log(`GET /vectors/collections - Listing collections for user: ${userId}`);

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = parseInt(limitArg || pageSizeArg || '20', 10);

    const result = await this.vectorRepository.listCollectionsByUserId(userId, pageNum, limitNum);

    return {
      data: result.data.map((c) => ({
        id: c.id,
        name: c.name,
        userId: c.userId,
        dimension: c.dimension,
        distance: c.distance,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get('collections/:id')
  async getCollection(@Param('id') id: string) {
    this.logger.log(`GET /vectors/collections/${id} - Getting collection`);
    const collection = await this.vectorRepository.findCollectionById(id);
    if (!collection) {
      return { error: 'Collection not found' };
    }
    return {
      id: collection.id,
      name: collection.name,
      userId: collection.userId,
      dimension: collection.dimension,
      distance: collection.distance,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    };
  }

  @Delete('collections/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCollection(@Param('id') id: string) {
    this.logger.log(`DELETE /vectors/collections/${id} - Deleting collection`);
    await this.deleteCollectionUseCase.execute(id);
  }

  @Post('documents')
  @HttpCode(HttpStatus.CREATED)
  async upsertDocument(@Body() dto: UpsertDocumentDto) {
    this.logger.log(
      `POST /vectors/documents - Upserting document to collection: ${dto.collectionId}`,
    );
    return await this.upsertDocumentUseCase.execute(dto);
  }

  @Post('documents/batch')
  @HttpCode(HttpStatus.CREATED)
  async upsertDocuments(@Body() dto: UpsertDocumentsDto) {
    this.logger.log(
      `POST /vectors/documents/batch - Batch upserting ${dto.documents.length} documents`,
    );
    return await this.upsertDocumentUseCase.executeBatch(dto);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(@Body() dto: SearchDto) {
    this.logger.log(`POST /vectors/search - Searching in collection: ${dto.collectionId}`);
    const results = await this.searchSimilarUseCase.execute(dto);
    return { results };
  }
}
