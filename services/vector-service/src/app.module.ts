import { Module } from '@nestjs/common';
import { ConfigModule } from './infrastructure/config/config.module';
import { PrismaService } from './infrastructure/database/prisma.service';
import { VectorRepository } from './infrastructure/persistence/vector.repository';
import { QdrantClientService } from './infrastructure/external/qdrant.client';
import { EmbeddingService } from './domain/services/embedding.service';
import { CreateCollectionUseCase } from './application/use-cases/create-collection.use-case';
import { UpsertDocumentUseCase } from './application/use-cases/upsert-document.use-case';
import { SearchSimilarUseCase } from './application/use-cases/search-similar.use-case';
import { VectorController } from './presentation/controllers/vector.controller';
import { HealthController } from './presentation/controllers/health.controller';

@Module({
  imports: [ConfigModule],
  controllers: [VectorController, HealthController],
  providers: [
    PrismaService,
    {
      provide: 'IVectorRepository',
      useClass: VectorRepository,
    },
    {
      provide: 'IQdrantClient',
      useClass: QdrantClientService,
    },
    EmbeddingService,
    CreateCollectionUseCase,
    UpsertDocumentUseCase,
    SearchSimilarUseCase,
  ],
})
export class AppModule {}
