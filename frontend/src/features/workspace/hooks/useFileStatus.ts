import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { FileNode } from '../store/workspaceStore';
import { fileIndexingApi } from '../api/fileIndexingApi';

export const INDEXABLE_EXTENSIONS = new Set([
  'txt', 'md', 'ts', 'tsx', 'js', 'jsx', 'json', 'yaml', 'yml',
  'py', 'go', 'rs', 'java', 'css', 'html', 'xml', 'sh', 'env',
  'toml', 'ini', 'sql', 'graphql', 'prisma', 'proto',
]);

export function useFileStatus(node: FileNode | null) {
  const isDir = node?.kind === 'directory';
  const ext = node?.name.split('.').pop()?.toLowerCase() ?? '';
  const isIndexable = !!node && !isDir && INDEXABLE_EXTENSIONS.has(ext);

  const { data: statusRecord, refetch } = useQuery({
    queryKey: ['fileStatus', node?.path],
    queryFn: () => node ? fileIndexingApi.getStatusByPath(node.path) : null,
    enabled: isIndexable && !!node,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'indexing' ? 2000 : false;
    },
  });

  const [lastModified, setLastModified] = useState<number | null>(null);

  useEffect(() => {
    if (isIndexable && node?.handle && node.handle.kind === 'file') {
      (node.handle as FileSystemFileHandle).getFile().then(file => {
        setLastModified(file.lastModified);
      });
    }
  }, [node?.handle, isIndexable]);

  const indexedAt = statusRecord?.indexedAt;
  const isModified = useMemo(() => {
    if (!indexedAt || !lastModified) return false;
    const indexedTime = new Date(indexedAt).getTime();
    return lastModified > indexedTime;
  }, [indexedAt, lastModified]);

  const status = statusRecord?.status || 'idle';

  return {
    status,
    isModified,
    isIndexable,
    refetch,
    indexedAt,
  };
}
