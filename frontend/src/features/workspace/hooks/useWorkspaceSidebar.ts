import React, { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useFileIndexing } from './useFileIndexing';
import { fileIndexingApi } from '../api/fileIndexingApi';
import { userApi } from '../api/userApi';
import { useModels } from '@/features/models/hooks/useModels';
import type { WorkspaceEntry, FileNode } from '../store/workspaceStore';

export function collectIndexableFiles(nodes: FileNode[], extensionsSet: Set<string>): FileNode[] {
  const result: FileNode[] = [];
  for (const node of nodes) {
    if (node.kind === 'file') {
      const ext = node.name.split('.').pop()?.toLowerCase() ?? '';
      if (extensionsSet.has(ext)) result.push(node);
    } else if (node.children) {
      result.push(...collectIndexableFiles(node.children, extensionsSet));
    }
  }
  return result;
}

export async function readFileContent(node: FileNode): Promise<string | null> {
  if (!node.handle) return null;
  try {
    const fileHandle = node.handle as FileSystemFileHandle;
    const file = await fileHandle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}

export function useWorkspaceSidebar(activeWorkspace: WorkspaceEntry | null) {
  const { t } = useTranslation('common');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [useSummarization, setUseSummarization] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>('');

  const { data: settingsData } = useQuery({
    queryKey: ['userSettings'],
    queryFn: () => userApi.getSettings(),
  });

  const indexableExtensions = React.useMemo(
    () =>
      new Set(
        settingsData?.settings?.indexableExtensions || [
          'txt',
          'md',
          'ts',
          'tsx',
          'js',
          'jsx',
          'json',
          'yaml',
          'yml',
          'py',
          'go',
          'rs',
          'java',
          'css',
          'html',
          'xml',
          'sh',
          'env',
          'toml',
          'ini',
          'sql',
          'graphql',
          'prisma',
          'proto',
        ],
      ),
    [settingsData],
  );

  const [bulkIndexing, setBulkIndexing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  const { data: modelsData } = useModels(1, 100);
  const models = React.useMemo(() => modelsData?.data || [], [modelsData]);

  const { getStatus, startIndexing } = useFileIndexing();

  const fileTree = activeWorkspace?.fileTree ?? null;

  const indexingPathsRef = useRef(new Set<string>());
  const indexedHashesRef = useRef(new Map<string, string>());

  const uploadMutation = useMutation<
    { node: FileNode; skipped?: boolean; recordId?: string; contentHash?: string },
    Error,
    FileNode
  >({
    mutationFn: async (node: FileNode) => {
      const content = await readFileContent(node);
      if (content === null) {
        throw new Error(`Cannot read ${node.name}`);
      }

      const configHash = useSummarization ? `sum:${selectedModelId}` : 'raw';
      const contentHash = `${content.length}-${[...content].reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0)}-${configHash}`;

      if (indexedHashesRef.current.get(node.path) === contentHash) {
        console.log(`Skipping ${node.name}, already indexed unchanged.`);
        return { node, skipped: true };
      }

      const form = new FormData();
      form.append('file', new Blob([content], { type: 'text/plain' }), node.name);

      const defaultEmbedModel =
        models.find(
          (m: { modelId?: string; isDefault?: boolean; id: string }) =>
            m.modelId?.includes('embed') || m.isDefault,
        ) || models[0];
      const embeddingModelId = selectedModelId || defaultEmbedModel?.id;

      const uploadRes = await apiClient.postForm(
        `/api/files/upload?workspacePath=${encodeURIComponent(node.path)}`,
        form,
      );
      const record = uploadRes.data;

      await fileIndexingApi.startIndexing(record.id, {
        embeddingModelId,
        useSummarization,
        summarizationModelId: useSummarization ? selectedModelId : undefined,
      });

      return { node, recordId: record.id, contentHash };
    },
    onSuccess: (data) => {
      if (data.skipped) return;
      startIndexing(data.recordId!);
      indexedHashesRef.current.set(data.node.path, data.contentHash!);
    },
    onError: (error, node) => {
      const apiError = error as {
        response?: { data?: Record<string, unknown> | string; status?: number };
      };
      const status = apiError.response?.status;
      const data = apiError.response?.data;
      const details =
        typeof data === 'object' && data !== null && 'message' in data
          ? (data as { message: string }).message
          : typeof data === 'string'
            ? data
            : error.message;
      console.error(`Upload/Index error (status: ${status}):`, details);
      toast.error(`Upload failed for ${node.name}: ${details}`);
    },
    onSettled: (data, error, node) => {
      indexingPathsRef.current.delete(node.path);
    },
  });

  const uploadAndIndex = useCallback(
    async (node: FileNode): Promise<void> => {
      if (useSummarization && !selectedModelId) {
        toast.error(t('workspace.selectModelRequired', 'Please select a model for summarization.'));
        return;
      }

      if (node.kind === 'directory') {
        const files = collectIndexableFiles(node.children ?? [], indexableExtensions);
        if (files.length === 0) {
          toast.info(`No indexable files found in ${node.name}`);
          return;
        }
        
        // Process directory files — we can do them in a loop
        // To avoid overlapping toast/progress issues, we just run them
        for (const file of files) {
          if (indexingPathsRef.current.has(file.path)) continue;
          indexingPathsRef.current.add(file.path);
          uploadMutation.mutate(file);
        }
        toast.success(`Started indexing ${files.length} files in ${node.name}`);
        return;
      }

      if (indexingPathsRef.current.has(node.path)) return;
      indexingPathsRef.current.add(node.path);

      await uploadMutation.mutateAsync(node);
    },
    [useSummarization, selectedModelId, t, uploadMutation, indexableExtensions],
  );

  const handleIndexWorkspace = useCallback(async () => {
    if (!fileTree) return;
    const files = collectIndexableFiles(fileTree.children ?? [], indexableExtensions);
    if (files.length === 0) {
      toast.info('No indexable text files found in this workspace');
      return;
    }
    setBulkIndexing(true);
    setBulkProgress({ done: 0, total: files.length });
    let done = 0;
    let errors = 0;
    for (const file of files) {
      try {
        await uploadAndIndex(file);
      } catch {
        errors++;
      }
      done++;
      setBulkProgress({ done, total: files.length });
    }
    setBulkIndexing(false);
    setBulkProgress(null);
    if (errors === 0) {
      toast.success(`Indexing started for ${files.length} files`);
    } else {
      toast.warning(`Indexing started with ${errors} error(s) out of ${files.length} files`);
    }
  }, [fileTree, uploadAndIndex, indexableExtensions]);

  return {
    isSettingsOpen,
    setIsSettingsOpen,
    useSummarization,
    setUseSummarization,
    selectedModelId,
    setSelectedModelId,
    bulkIndexing,
    bulkProgress,
    models,
    getStatus,
    handleIndexWorkspace,
    uploadAndIndex,
    t,
  };
}
