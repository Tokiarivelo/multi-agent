import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileNode } from '../store/workspaceStore';
import type { IndexStatus } from '../api/fileIndexingApi';

export const INDEXABLE_EXTENSIONS = new Set([
  'txt', 'md', 'ts', 'tsx', 'js', 'jsx', 'json', 'yaml', 'yml',
  'py', 'go', 'rs', 'java', 'css', 'html', 'xml', 'sh', 'env',
  'toml', 'ini', 'sql', 'graphql', 'prisma', 'proto',
]);

export function useWorkspaceFileTreeNode(
  node: FileNode,
  onSelect: (node: FileNode) => void,
  selectedPath: string | null,
  onIndexFile?: (node: FileNode) => Promise<void>
) {
  const [isOpen, setIsOpen] = useState(false);
  const [localStatus, setLocalStatus] = useState<IndexStatus>('idle');
  const isSelected = selectedPath === node.path;
  const isDir = node.kind === 'directory';
  const ext = node.name.split('.').pop()?.toLowerCase() ?? '';
  const isIndexable = !isDir && INDEXABLE_EXTENSIONS.has(ext);

  const handleClick = () => {
    onSelect(node);
    if (isDir) setIsOpen(!isOpen);
  };

  const handleIndex = async () => {
    if (!onIndexFile) return;
    setLocalStatus('indexing');
    try {
      await onIndexFile(node);
      setLocalStatus('indexed');
    } catch {
      setLocalStatus('error');
    }
  };

  return {
    isOpen,
    localStatus,
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
