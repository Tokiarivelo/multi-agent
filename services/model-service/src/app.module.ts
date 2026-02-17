import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

// Infrastructure
import { PrismaService, ModelRepository, ApiKeyRepository } from './infrastructure/database';
import { EncryptionService, ProviderValidatorService } from './infrastructure/services';

// Use Cases
import {
  CreateModelUseCase,
  GetModelUseCase,
  ListModelsUseCase,
  UpdateModelUseCase,
  DeleteModelUseCase,
  AddApiKeyUseCase,
  GetApiKeyUseCase,
  ListApiKeysUseCase,
  UpdateApiKeyUseCase,
  DeleteApiKeyUseCase,
} from './application/use-cases';

// Controllers
import { ModelController, ApiKeyController, HealthController } from './presentation/controllers';

// Repository tokens
import { ModelRepositoryInterface } from './domain/repositories/model.repository.interface';
import { ApiKeyRepositoryInterface } from './domain/repositories/api-key.repository.interface';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    HttpModule,
  ],
  controllers: [ModelController, ApiKeyController, HealthController],
  providers: [
    // Infrastructure
    PrismaService,
    EncryptionService,
    ProviderValidatorService,

    // Repositories
    {
      provide: 'ModelRepositoryInterface',
      useClass: ModelRepository,
    },
    {
      provide: 'ApiKeyRepositoryInterface',
      useClass: ApiKeyRepository,
    },

    // Use Cases - Models
    {
      provide: CreateModelUseCase,
      useFactory: (repo: ModelRepositoryInterface) => new CreateModelUseCase(repo),
      inject: ['ModelRepositoryInterface'],
    },
    {
      provide: GetModelUseCase,
      useFactory: (repo: ModelRepositoryInterface) => new GetModelUseCase(repo),
      inject: ['ModelRepositoryInterface'],
    },
    {
      provide: ListModelsUseCase,
      useFactory: (repo: ModelRepositoryInterface) => new ListModelsUseCase(repo),
      inject: ['ModelRepositoryInterface'],
    },
    {
      provide: UpdateModelUseCase,
      useFactory: (repo: ModelRepositoryInterface) => new UpdateModelUseCase(repo),
      inject: ['ModelRepositoryInterface'],
    },
    {
      provide: DeleteModelUseCase,
      useFactory: (repo: ModelRepositoryInterface) => new DeleteModelUseCase(repo),
      inject: ['ModelRepositoryInterface'],
    },

    // Use Cases - API Keys
    {
      provide: AddApiKeyUseCase,
      useFactory: (
        repo: ApiKeyRepositoryInterface,
        encryption: EncryptionService,
        validator: ProviderValidatorService,
      ) => new AddApiKeyUseCase(repo, encryption, validator),
      inject: ['ApiKeyRepositoryInterface', EncryptionService, ProviderValidatorService],
    },
    {
      provide: GetApiKeyUseCase,
      useFactory: (repo: ApiKeyRepositoryInterface, encryption: EncryptionService) =>
        new GetApiKeyUseCase(repo, encryption),
      inject: ['ApiKeyRepositoryInterface', EncryptionService],
    },
    {
      provide: ListApiKeysUseCase,
      useFactory: (repo: ApiKeyRepositoryInterface) => new ListApiKeysUseCase(repo),
      inject: ['ApiKeyRepositoryInterface'],
    },
    {
      provide: UpdateApiKeyUseCase,
      useFactory: (repo: ApiKeyRepositoryInterface) => new UpdateApiKeyUseCase(repo),
      inject: ['ApiKeyRepositoryInterface'],
    },
    {
      provide: DeleteApiKeyUseCase,
      useFactory: (repo: ApiKeyRepositoryInterface) => new DeleteApiKeyUseCase(repo),
      inject: ['ApiKeyRepositoryInterface'],
    },
  ],
})
export class AppModule {}
