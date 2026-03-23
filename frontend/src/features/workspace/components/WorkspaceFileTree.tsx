import React from 'react';
import { FileNode } from '../store/workspaceStore';
import {
  Folder, FolderOpen, FileText, FileJson, FileCode, FileImage,
  DatabaseZap, Loader2, CheckCircle2, AlertCircle, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileIndexStatus, IndexStatus } from '../api/fileIndexingApi';
import { useWorkspaceFileTreeLogic, useWorkspaceFileTreeNode, useBulkFileStatus } from '../hooks/useWorkspaceFileTree';
import { useGitignore } from '../hooks/useGitignore';

interface WorkspaceFileTreeProps {
  nodes: FileNode[];
  onSelect: (node: FileNode) => void;
  selectedPath: string | null;
  getIndexStatus?: (fileId: string) => FileIndexStatus;
  onIndexFile?: (node: FileNode) => Promise<void>;
  rootHandle?: FileSystemDirectoryHandle;
}

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'json':
      return <FileJson className="h-4 w-4 text-amber-500" />;
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <FileCode className="h-4 w-4 text-blue-500" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
      return <FileImage className="h-4 w-4 text-green-500" />;
    case 'html':
    case 'css':
      return <FileCode className="h-4 w-4 text-purple-500" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
};

const IndexStatusBadge = ({
  status,
  isModified,
  onIndex,
}: {
  status: IndexStatus;
  isModified?: boolean;
  onIndex: () => void;
}) => {
  if (status === 'indexing') {
    return <span title="Indexing…"><Loader2 className="h-3 w-3 text-violet-400 animate-spin shrink-0" /></span>;
  }

  if (status === 'indexed') {
    if (isModified) {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); onIndex(); }}
          className="h-3 w-3 text-yellow-500 hover:text-yellow-400 transition-colors shrink-0"
          title="File modified since last indexing. Refresh to update."
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      );
    }
    return <span title="Indexed in vector DB"><CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" /></span>;
  }

  if (status === 'error') {
    return <span title="Indexing failed"><AlertCircle className="h-3 w-3 text-red-500 shrink-0" /></span>;
  }
  // idle: show index button on hover
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onIndex(); }}
      className="h-3 w-3 text-muted-foreground/40 hover:text-violet-400 transition-colors shrink-0 opacity-0 group-hover/file:opacity-100"
      title="Index this file into vector DB"
    >
      <DatabaseZap className="h-3 w-3" />
    </button>
  );
};

const FileTreeNode = ({
  node,
  onSelect,
  selectedPath,
  depth = 0,
  getIndexStatus,
  onIndexFile,
  globalStatuses,
  globalRefetch,
  isIgnoredByGitignore,
}: {
  node: FileNode;
  onSelect: (node: FileNode) => void;
  selectedPath: string | null;
  depth?: number;
  getIndexStatus?: (fileId: string) => FileIndexStatus;
  onIndexFile?: (node: FileNode) => Promise<void>;
  globalStatuses?: Record<string, FileIndexStatus & { id?: string }>;
  globalRefetch?: () => void;
  isIgnoredByGitignore?: (path: string, isDir: boolean) => boolean;
}) => {
  const {
    isOpen,
    status,
    isModified,
    isSelected,
    isDir,
    isIndexable,
    handleClick,
    handleIndex,
  } = useWorkspaceFileTreeNode(
    node,
    onSelect,
    selectedPath,
    onIndexFile,
    globalStatuses?.[node.path],
    globalRefetch
  );

  const isNotIndexable = !isDir && !isIndexable;
  const isGitignored = isIgnoredByGitignore?.(node.path, isDir) ?? false;

  // Tooltip explains why the file is dimmed
  const title = isGitignored
    ? `${node.name} (git ignored)`
    : isModified
    ? `${node.name} (Modified)`
    : node.name;

  return (
    <div>
      <div
        className={cn(
          'group/file flex items-center gap-2 px-2 py-1.5 cursor-pointer text-sm rounded-md transition-colors w-full',
          // Gitignored: muted + italic, like VS Code
          isGitignored && 'opacity-60 text-muted-foreground italic hover:opacity-80',
          // Non-indexable extension: slightly dimmed but still normal cursor
          !isGitignored && isNotIndexable && 'opacity-50 text-muted-foreground',
          // Normal: selected or hover state
          !isGitignored && !isNotIndexable && (
            isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-foreground/80'
          ),
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
        title={title}
      >
        {isDir ? (
          isOpen ? (
            <FolderOpen className={cn('h-4 w-4 shrink-0', isGitignored ? 'text-muted-foreground' : 'text-blue-500')} />
          ) : (
            <Folder className={cn('h-4 w-4 shrink-0', isGitignored ? 'text-muted-foreground' : 'text-blue-500')} />
          )
        ) : (
          <span className={cn('shrink-0', (isGitignored || isNotIndexable) && 'grayscale opacity-70')}>
            {getFileIcon(node.name)}
          </span>
        )}
        <span className={cn(
          'truncate flex-1',
          !isGitignored && !isNotIndexable && isModified && 'text-amber-500 italic font-medium',
        )}>
          {node.name}
        </span>
        {isIndexable && !isGitignored && (
          <IndexStatusBadge status={status} isModified={isModified} onIndex={handleIndex} />
        )}
      </div>

      {isDir && isOpen && node.children && (
        <div className="flex flex-col w-full">
          {node.children.map((child, idx) => (
            <FileTreeNode
              key={`${child.path}-${idx}`}
              node={child}
              onSelect={onSelect}
              selectedPath={selectedPath}
              depth={depth + 1}
              getIndexStatus={getIndexStatus}
              onIndexFile={onIndexFile}
              globalStatuses={globalStatuses}
              globalRefetch={globalRefetch}
              isIgnoredByGitignore={isIgnoredByGitignore}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export function WorkspaceFileTree({
  nodes,
  onSelect,
  selectedPath,
  getIndexStatus,
  onIndexFile,
  rootHandle,
}: WorkspaceFileTreeProps) {
  const { t } = useWorkspaceFileTreeLogic();
  const { bulkStatuses, refetchGlobal } = useBulkFileStatus(nodes);
  const { isIgnoredByGitignore } = useGitignore(rootHandle);

  if (!nodes || nodes.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground italic">
        {t('workspace.empty', 'No files found')}
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full space-y-0.5 max-w-full overflow-x-hidden">
      {nodes.map((node, idx) => (
        <FileTreeNode
          key={`${node.path}-${idx}`}
          node={node}
          onSelect={onSelect}
          selectedPath={selectedPath}
          depth={0}
          getIndexStatus={getIndexStatus}
          onIndexFile={onIndexFile}
          globalStatuses={bulkStatuses}
          globalRefetch={refetchGlobal}
          isIgnoredByGitignore={isIgnoredByGitignore}
        />
      ))}
    </div>
  );
}
