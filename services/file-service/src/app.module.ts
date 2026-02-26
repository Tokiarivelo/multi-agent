import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MinioService } from './infrastructure/minio/minio.service';
import { InMemoryFileRepository } from './infrastructure/persistence/file.repository';
import { FILE_REPOSITORY } from './domain/file.entity';
import { FileService } from './application/file.service';
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
    MinioService,
    {
      provide: FILE_REPOSITORY,
      useClass: InMemoryFileRepository,
    },
    FileService,
  ],
})
export class AppModule {}
