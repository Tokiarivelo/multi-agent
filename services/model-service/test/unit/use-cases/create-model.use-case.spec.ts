import { Test, TestingModule } from '@nestjs/testing';
import { CreateModelUseCase } from '../../../src/application/use-cases/create-model.use-case';
import { ModelRepositoryInterface } from '../../../src/domain/repositories/model.repository.interface';
import { ModelProvider } from '../../../src/domain/entities/model.entity';
import { ConflictException } from '@nestjs/common';

describe('CreateModelUseCase', () => {
  let useCase: CreateModelUseCase;
  let mockRepository: jest.Mocked<ModelRepositoryInterface>;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByProvider: jest.fn(),
      getDefaultModel: jest.fn(),
      setDefaultModel: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: CreateModelUseCase,
          useFactory: () => new CreateModelUseCase(mockRepository),
        },
      ],
    }).compile();

    useCase = module.get<CreateModelUseCase>(CreateModelUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  describe('execute', () => {
    it('should create a new model successfully', async () => {
      const input = {
        name: 'gpt-4-turbo',
        provider: ModelProvider.OPENAI,
        modelId: 'gpt-4-turbo-preview',
        maxTokens: 128000,
      };

      const expectedModel = {
        id: 'uuid',
        ...input,
        supportsStreaming: true,
        isActive: true,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findByName.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(expectedModel);

      const result = await useCase.execute(input);

      expect(mockRepository.findByName).toHaveBeenCalledWith(input.name);
      expect(mockRepository.create).toHaveBeenCalledWith(input);
      expect(result).toEqual(expectedModel);
    });

    it('should throw ConflictException if model name already exists', async () => {
      const input = {
        name: 'gpt-4-turbo',
        provider: ModelProvider.OPENAI,
        modelId: 'gpt-4-turbo-preview',
      };

      const existingModel = {
        id: 'existing-uuid',
        ...input,
        maxTokens: 4096,
        supportsStreaming: true,
        isActive: true,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findByName.mockResolvedValue(existingModel);

      await expect(useCase.execute(input)).rejects.toThrow(ConflictException);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should set model as default if requested', async () => {
      const input = {
        name: 'gpt-4-turbo',
        provider: ModelProvider.OPENAI,
        modelId: 'gpt-4-turbo-preview',
        isDefault: true,
      };

      const createdModel = {
        id: 'uuid',
        ...input,
        maxTokens: 4096,
        supportsStreaming: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findByName.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(createdModel);
      mockRepository.setDefaultModel.mockResolvedValue(createdModel);

      const result = await useCase.execute(input);

      expect(mockRepository.setDefaultModel).toHaveBeenCalledWith('uuid');
      expect(result).toEqual(createdModel);
    });
  });
});
