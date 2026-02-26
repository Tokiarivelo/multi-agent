import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useApiKeys,
  useCreateApiKey,
  useUpdateApiKey,
  useDeleteApiKey,
  apiKeyQueryKeys,
} from '../hooks/useApiKeys';
import { apiKeysApi } from '../api/api-keys.api';
import { ApiKey } from '@/types';

// Mock the API layer
jest.mock('../api/api-keys.api');

const mockedApi = apiKeysApi as jest.Mocked<typeof apiKeysApi>;

// Helper to create a fresh QueryClient wrapper for each test
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('API Key Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('apiKeyQueryKeys', () => {
    it('should generate correct query keys', () => {
      expect(apiKeyQueryKeys.all).toEqual(['apiKeys']);
      expect(apiKeyQueryKeys.byUser('user-1')).toEqual(['apiKeys', 'user-1']);
      expect(apiKeyQueryKeys.byProvider('user-1', 'OPENAI')).toEqual([
        'apiKeys',
        'user-1',
        'OPENAI',
      ]);
      expect(apiKeyQueryKeys.detail('key-1')).toEqual(['apiKeys', 'detail', 'key-1']);
    });
  });

  describe('useApiKeys', () => {
    it('should fetch API keys when userId is provided', async () => {
      const mockKeys = [
        {
          id: 'key-1',
          userId: 'user-1',
          provider: 'OPENAI',
          keyName: 'Test Key',
          apiKeyHash: 'hash',
          isActive: true,
          isValid: true,
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
      ];
      mockedApi.getAll.mockResolvedValue(mockKeys as unknown as ApiKey[]);

      const { result } = renderHook(() => useApiKeys('user-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedApi.getAll).toHaveBeenCalledWith('user-1');
      expect(result.current.data).toEqual(mockKeys);
    });

    it('should not fetch when userId is undefined', () => {
      const { result } = renderHook(() => useApiKeys(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(mockedApi.getAll).not.toHaveBeenCalled();
    });
  });

  describe('useCreateApiKey', () => {
    it('should call create and invalidate queries on success', async () => {
      const newKey = {
        id: 'key-new',
        userId: 'user-1',
        provider: 'OPENAI',
        keyName: 'New Key',
        apiKeyHash: 'hash',
        isActive: true,
        isValid: true,
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      };
      mockedApi.create.mockResolvedValue(newKey as unknown as ApiKey);

      const { result } = renderHook(() => useCreateApiKey('user-1'), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        userId: 'user-1',
        provider: 'OPENAI',
        keyName: 'New Key',
        apiKey: 'sk-abc123',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedApi.create).toHaveBeenCalledWith({
        userId: 'user-1',
        provider: 'OPENAI',
        keyName: 'New Key',
        apiKey: 'sk-abc123',
      });
    });
  });

  describe('useUpdateApiKey', () => {
    it('should call update with correct params', async () => {
      const updatedKey = {
        id: 'key-1',
        userId: 'user-1',
        provider: 'OPENAI',
        keyName: 'Updated',
        isActive: false,
      };
      mockedApi.update.mockResolvedValue(updatedKey as unknown as ApiKey);

      const { result } = renderHook(() => useUpdateApiKey('user-1'), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        id: 'key-1',
        input: { keyName: 'Updated', isActive: false },
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedApi.update).toHaveBeenCalledWith('key-1', {
        keyName: 'Updated',
        isActive: false,
      });
    });
  });

  describe('useDeleteApiKey', () => {
    it('should call delete with correct ID', async () => {
      mockedApi.delete.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteApiKey('user-1'), {
        wrapper: createWrapper(),
      });

      result.current.mutate('key-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedApi.delete).toHaveBeenCalledWith('key-1');
    });
  });
});
