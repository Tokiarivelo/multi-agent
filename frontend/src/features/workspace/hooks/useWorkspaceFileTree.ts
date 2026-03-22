import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { type FileNode } from '../store/workspaceStore';
import { fileIndexingApi, type FileIndexStatus } from '../api/fileIndexingApi';
import { useQuery } from '@tanstack/react-query';

export const INDEXABLE_EXTENSIONS = new Set([
  'txt', 'md', 'ts', 'tsx', 'js', 'jsx', 'json', 'yaml', 'yml',
  'py', 'go', 'rs', 'java', 'css', 'html', 'xml', 'sh', 'env',
  'toml', 'ini', 'sql', 'graphql', 'prisma', 'proto',
]);

export function useBulkFileStatus(nodes: FileNode[]) {
  const allPaths = useMemo(() => {
    const paths: string[] = [];
    const traverse = (n: FileNode[]) => {
      for (const node of n) {
        if (node.kind === 'file') {
           const ext = node.name.split('.').pop()?.toLowerCase() ?? '';
           if (INDEXABLE_EXTENSIONS.has(ext)) {
             paths.push(node.path);
           }
        }
        if (node.children) traverse(node.children);
      }
    };
    if (nodes) traverse(nodes);
    return paths;
  }, [nodes]);

  const { data: bulkStatuses, refetch } = useQuery({
    queryKey: ['bulkFileStatus', allPaths],
    queryFn: () => allPaths.length > 0 ? fileIndexingApi.getBulkStatusByPaths(allPaths) : {},
    enabled: allPaths.length > 0,
    refetchInterval: (query) => {
      const values = Object.values(query.state.data || {});
      return values.some((s: unknown) => (s as FileIndexStatus)?.status === 'indexing') ? 2000 : false;
    },
  });

  return { bulkStatuses: bulkStatuses || {}, refetchGlobal: refetch };
}

export function useWorkspaceFileTreeNode(
  node: FileNode,
  onSelect: (node: FileNode) => void,
  selectedPath: string | null,
  onIndexFile?: (node: FileNode) => Promise<void>,
  statusRecord?: FileIndexStatus,
  globalRefetch?: () => void
) {
  const isDir = node.kind === 'directory';
  const ext = node.name.split('.').pop()?.toLowerCase() ?? '';
  // Permit both indexable files and ALL directories
  const isIndexable = (node.kind === 'file' && INDEXABLE_EXTENSIONS.has(ext)) || isDir;

  const [lastModified, setLastModified] = useState<number | null>(null);

  useEffect(() => {
    if (isIndexable && node.handle && node.handle.kind === 'file') {
      (node.handle as FileSystemFileHandle).getFile().then(file => {
        setLastModified(file.lastModified);
      });
    }
  }, [node.handle, isIndexable]);

  const indexedAt = statusRecord?.indexedAt;
  const isModified = useMemo(() => {
    if (!indexedAt || !lastModified) return false;
    const indexedTime = new Date(indexedAt).getTime();
    return lastModified > indexedTime;
  }, [indexedAt, lastModified]);

  const status = statusRecord?.status || 'idle';

  const [isOpen, setIsOpen] = useState(false);
  const isSelected = selectedPath === node.path;

  const handleClick = () => {
    onSelect(node);
    if (isDir) setIsOpen(!isOpen);
  };

  const handleIndex = async () => {
    if (!onIndexFile) return;
    try {
      // For directories, we call a slightly different logic? 
      // Actually, onIndexFile in Sidebar/WorkspacePage should be updated.
      await onIndexFile(node);
      if (globalRefetch) globalRefetch();
    } catch (err) {
      console.error('Indexing failed:', err);
    }
  };

  return {
    isOpen,
    status,
    isModified,
    isSelected,
    isDir,
    isIndexable,
    handleClick,
    handleIndex,
  };
}

export function useWorkspaceFileTreeLogic() {
  const { t } = useTranslation('common');
  return { t };
}
