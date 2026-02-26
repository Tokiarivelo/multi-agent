import { apiKeysApi } from '../api/api-keys.api';

// Mock the apiClient module
jest.mock('@/lib/api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

describe('apiKeysApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should fetch all API keys for a user', async () => {
      const mockKeys = [
        { id: 'key-1', provider: 'OPENAI', keyName: 'My Key' },
        { id: 'key-2', provider: 'ANTHROPIC', keyName: 'Anthropic Key' },
      ];
      mockedClient.get.mockResolvedValue({ data: mockKeys });

      const result = await apiKeysApi.getAll('user-123');

      expect(mockedClient.get).toHaveBeenCalledWith('/api/api-keys?userId=user-123');
      expect(result).toEqual(mockKeys);
    });
  });

  describe('getById', () => {
    it('should fetch a single API key by ID', async () => {
      const mockKey = { id: 'key-1', provider: 'OPENAI', keyName: 'My Key' };
      mockedClient.get.mockResolvedValue({ data: { data: mockKey } });

      const result = await apiKeysApi.getById('key-1');

      expect(mockedClient.get).toHaveBeenCalledWith('/api/api-keys/key-1');
      expect(result).toEqual(mockKey);
    });
  });

  describe('getByProvider', () => {
    it('should fetch API keys filtered by provider', async () => {
      const mockKeys = [{ id: 'key-1', provider: 'OPENAI' }];
      mockedClient.get.mockResolvedValue({ data: mockKeys });

      const result = await apiKeysApi.getByProvider('user-123', 'OPENAI');

      expect(mockedClient.get).toHaveBeenCalledWith(
        '/api/api-keys/provider/OPENAI?userId=user-123',
      );
      expect(result).toEqual(mockKeys);
    });
  });

  describe('create', () => {
    it('should create a new API key', async () => {
      const input = {
        userId: 'user-123',
        provider: 'OPENAI',
        keyName: 'My Key',
        apiKey: 'sk-abc123',
      };
      const createdKey = { id: 'key-new', ...input };
      mockedClient.post.mockResolvedValue({ data: createdKey });

      const result = await apiKeysApi.create(input);

      expect(mockedClient.post).toHaveBeenCalledWith('/api/api-keys', input);
      expect(result).toEqual(createdKey);
    });
  });

  describe('update', () => {
    it('should update an API key', async () => {
      const updatedKey = { id: 'key-1', keyName: 'Updated Name', isActive: false };
      mockedClient.put.mockResolvedValue({ data: updatedKey });

      const result = await apiKeysApi.update('key-1', {
        keyName: 'Updated Name',
        isActive: false,
      });

      expect(mockedClient.put).toHaveBeenCalledWith('/api/api-keys/key-1', {
        keyName: 'Updated Name',
        isActive: false,
      });
      expect(result).toEqual(updatedKey);
    });
  });

  describe('delete', () => {
    it('should delete an API key', async () => {
      mockedClient.delete.mockResolvedValue({});

      await apiKeysApi.delete('key-1');

      expect(mockedClient.delete).toHaveBeenCalledWith('/api/api-keys/key-1');
    });
  });
});
