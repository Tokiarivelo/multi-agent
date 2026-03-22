'use client';

import { useState, useCallback, useRef } from 'react';
import { fileIndexingApi, FileIndexStatus, IndexStatus } from '../api/fileIndexingApi';

interface IndexingState {
  [fileId: string]: FileIndexStatus;
}

export function useFileIndexing() {
  const [states, setStates] = useState<IndexingState>({});
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const getStatus = useCallback((fileId: string): FileIndexStatus => {
    return states[fileId] ?? { fileId, status: 'idle', collectionId: null, chunkCount: 0, indexedAt: null, error: null };
  }, [states]);

  const stopPolling = useCallback((fileId: string) => {
    const timer = pollTimers.current.get(fileId);
    if (timer) {
      clearInterval(timer);
      pollTimers.current.delete(fileId);
    }
  }, []);

  const pollStatus = useCallback((fileId: string) => {
    stopPolling(fileId);
    const timer = setInterval(async () => {
      try {
        const status = await fileIndexingApi.getStatus(fileId);
        setStates((prev) => ({ ...prev, [fileId]: status }));
        if (status.status === 'indexed' || status.status === 'error') {
          stopPolling(fileId);
        }
      } catch {
        stopPolling(fileId);
      }
    }, 1500);
    pollTimers.current.set(fileId, timer);
  }, [stopPolling]);

  const startIndexing = useCallback(async (fileId: string) => {
    setStates((prev) => ({
      ...prev,
      [fileId]: { fileId, status: 'indexing', collectionId: null, chunkCount: 0, indexedAt: null, error: null },
    }));
    try {
      await fileIndexingApi.startIndexing(fileId);
      pollStatus(fileId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start indexing';
      setStates((prev) => ({
        ...prev,
        [fileId]: { fileId, status: 'error', collectionId: null, chunkCount: 0, indexedAt: null, error: msg },
      }));
    }
  }, [pollStatus]);

  const removeIndex = useCallback(async (fileId: string) => {
    stopPolling(fileId);
    await fileIndexingApi.removeIndex(fileId);
    setStates((prev) => {
      const next = { ...prev };
      delete next[fileId];
      return next;
    });
  }, [stopPolling]);

  return { getStatus, startIndexing, removeIndex };
}
