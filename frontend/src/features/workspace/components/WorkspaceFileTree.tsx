import React, { useState } from 'react';
import { FileNode } from '../store/workspaceStore';
import { Folder, FolderOpen, FileText, FileJson, FileCode, FileImage } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface WorkspaceFileTreeProps {
  nodes: FileNode[];
  onSelect: (node: FileNode) => void;
  selectedPath: string | null;
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

const FileTreeNode = ({
  node,
  onSelect,
  selectedPath,
  depth = 0,
}: {
  node: FileNode;
  onSelect: (node: FileNode) => void;
  selectedPath: string | null;
  depth?: number;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isSelected = selectedPath === node.path;
  const isDir = node.kind === 'directory';

  const handleClick = () => {
    onSelect(node);
    if (isDir) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 cursor-pointer text-sm rounded-md transition-colors w-full break-all whitespace-nowrap overflow-hidden text-ellipsis',
          isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-foreground/80',
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
        title={node.name}
      >
        {isDir ? (
          isOpen ? (
            <FolderOpen className="h-4 w-4 text-blue-500 shrink-0" />
          ) : (
            <Folder className="h-4 w-4 text-blue-500 shrink-0" />
          )
        ) : (
          getFileIcon(node.name)
        )}
        <span className="truncate">{node.name}</span>
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
            />
          ))}
        </div>
      )}
    </div>
  );
};

export function WorkspaceFileTree({ nodes, onSelect, selectedPath }: WorkspaceFileTreeProps) {
  const { t } = useTranslation('common');
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
        />
      ))}
    </div>
  );
}
