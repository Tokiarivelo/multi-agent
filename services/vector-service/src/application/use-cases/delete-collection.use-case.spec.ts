import { NotFoundException } from '@nestjs/common';
import { DeleteCollectionUseCase } from './delete-collection.use-case';
import { Collection } from '../../domain/entities/collection.entity';
import { IVectorRepository } from '../../domain/repositories/vector.repository.interface';
import { IQdrantClient } from '../interfaces/qdrant.client.interface';

describe('DeleteCollectionUseCase', () => {
  const makeCollection = () =>
    new Collection('col-1', 'knowledge', 'user-1', 384, 'cosine', new Date(), new Date());

  const vectorRepository: jest.Mocked<IVectorRepository> = {
    createCollection: jest.fn(),
    findCollectionById: jest.fn(),
    findCollectionByNameAndUserId: jest.fn(),
    listCollectionsByUserId: jest.fn(),
    deleteCollection: jest.fn(),
  };

  const qdrantClient: jest.Mocked<IQdrantClient> = {
    createCollection: jest.fn(),
    deleteCollection: jest.fn(),
    upsertPoints: jest.fn(),
    search: jest.fn(),
    collectionExists: jest.fn(),
    listCollections: jest.fn(),
  };

  let useCase: DeleteCollectionUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new DeleteCollectionUseCase(vectorRepository, qdrantClient);
  });

  it('throws when the collection is not found', async () => {
    vectorRepository.findCollectionById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(NotFoundException);

    expect(qdrantClient.collectionExists).not.toHaveBeenCalled();
    expect(vectorRepository.deleteCollection).not.toHaveBeenCalled();
  });

  it('deletes from Qdrant and metadata storage when collection exists in Qdrant', async () => {
    const collection = makeCollection();
    vectorRepository.findCollectionById.mockResolvedValue(collection);
    qdrantClient.collectionExists.mockResolvedValue(true);

    await useCase.execute(collection.id);

    expect(qdrantClient.collectionExists).toHaveBeenCalledWith('user-1_knowledge');
    expect(qdrantClient.deleteCollection).toHaveBeenCalledWith('user-1_knowledge');
    expect(vectorRepository.deleteCollection).toHaveBeenCalledWith('col-1');
  });

  it('deletes only metadata when Qdrant collection does not exist', async () => {
    const collection = makeCollection();
    vectorRepository.findCollectionById.mockResolvedValue(collection);
    qdrantClient.collectionExists.mockResolvedValue(false);

    await useCase.execute(collection.id);

    expect(qdrantClient.deleteCollection).not.toHaveBeenCalled();
    expect(vectorRepository.deleteCollection).toHaveBeenCalledWith('col-1');
  });
});
