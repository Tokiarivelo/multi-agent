import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MinioService } from './infrastructure/minio/minio.service';
import { PrismaFileRepository } from './infrastructure/persistence/prisma-file.repository';
import { PrismaService } from '@multi-agent/database';
import { FILE_REPOSITORY } from './domain/file.entity';
import { FileService } from './application/file.service';
import { FileIndexingService } from './application/file-indexing.service';
import { VectorClientService } from './infrastructure/http/vector-client.service';
import { ModelClientService } from './infrastructure/http/model-client.service';
import { FileController } from './presentation/controllers/file.controller';
import { HealthController } from './presentation/controllers/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
  ],
  controllers: [FileController, HealthController],
  providers: [
    PrismaService,
    MinioService,
    VectorClientService,
    ModelClientService,
    {
      provide: FILE_REPOSITORY,
      useClass: PrismaFileRepository,
    },
    FileService,
    FileIndexingService,
  ],
})
export class AppModule {}
