'use client';

import React, { useState } from 'react';
import { Resizable } from 're-resizable';
import {
  LayoutPanelLeft,
  FilePlus,
  FolderPlus,
  RefreshCw,
  Terminal,
  DatabaseZap,
  Settings,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WorkspaceFileTree } from './WorkspaceFileTree';
import { WorkspaceEntry, FileNode } from '../store/workspaceStore';
import { nativePathValidationError } from '../utils/pathValidation';
import { useWorkspaceSidebar } from '../hooks/useWorkspaceSidebar';
import { WorkspaceSettings } from './WorkspaceSettings';

interface WorkspaceSidebarProps {
  activeWorkspace: WorkspaceEntry | null;
  selectedPath: string | null;
  onSelectNode: (node: FileNode) => void;
  refreshTree: () => void;
  createItem: (type: 'file' | 'directory', name: string, selectedPath?: string | null) => void;
  updateWorkspaceLocalPath: (id: string, path: string) => void;
}

export function WorkspaceSidebar({
  activeWorkspace,
  selectedPath,
  onSelectNode,
  refreshTree,
  createItem,
  updateWorkspaceLocalPath,
}: WorkspaceSidebarProps) {
  const [nativePathError, setNativePathError] = useState<string | null>(null);

  const {
    isSettingsOpen, setIsSettingsOpen,
    useSummarization, setUseSummarization,
    selectedModelId, setSelectedModelId,
    bulkIndexing,
    bulkProgress,
    models,
    getStatus,
    handleIndexWorkspace,
    uploadAndIndex,
    t,
  } = useWorkspaceSidebar(activeWorkspace);

  const fileTree = activeWorkspace?.fileTree ?? null;
  const indexedCount = bulkProgress?.done ?? 0;

  return (
    <Resizable
      defaultSize={{ width: 280, height: '100%' }}
      minWidth={160}
      maxWidth={500}
      enable={{ right: true }}
      handleClasses={{ right: 'hover:bg-primary/50 bg-border/40 w-1 transition-colors z-20' }}
      className="flex flex-col bg-card/60 border-r border-border/50"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 shrink-0 bg-background/50 backdrop-blur-md">
        <h3 className="text-xs font-semibold tracking-tight uppercase text-muted-foreground flex items-center gap-1.5">
          <LayoutPanelLeft className="w-3.5 h-3.5" />
          {t('workspace.explorer', 'Explorer')}
        </h3>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => {
              const name = prompt(t('workspace.newFilePrompt', 'Enter file name:'));
              if (name) createItem('file', name, selectedPath);
            }}
            title={t('workspace.newFile', 'New File')}
          >
            <FilePlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => {
              const name = prompt(t('workspace.newFolderPrompt', 'Enter folder name:'));
              if (name) createItem('directory', name, selectedPath);
            }}
            title={t('workspace.newFolder', 'New Folder')}
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground"
            onClick={() => refreshTree()}
            title={t('workspace.refresh', 'Refresh')}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-primary"
            onClick={() => setIsSettingsOpen(true)}
            title={t('workspace.settings', 'Workspace Settings')}
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-violet-400"
            onClick={handleIndexWorkspace}
            disabled={bulkIndexing || !fileTree}
            title={t('workspace.indexWorkspace', 'Index workspace files into vector DB')}
          >
            {bulkIndexing
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <DatabaseZap className="h-3.5 w-3.5" />
            }
          </Button>
        </div>
      </div>

      {/* Bulk indexing progress */}
      {bulkProgress && (
        <div className="mx-2 mt-1.5 px-2 py-1 rounded bg-violet-500/10 border border-violet-500/20 text-[10px] text-violet-300 flex items-center gap-1.5">
          <Loader2 className="h-2.5 w-2.5 animate-spin shrink-0" />
          Indexing {bulkProgress.done}/{bulkProgress.total} files…
        </div>
      )}

      <ScrollArea className="flex-1">
        {/* Server Context mapping for Shell/Tools */}
        <div className="mx-2 my-2 px-2 py-2 rounded-lg bg-muted/30 border border-border/40 group">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-1">
              <Terminal className="h-2.5 w-2.5 text-lime-500" />
              {t('workspace.serverContext', 'Server Context (CWD)')}
            </span>
            <button
              onClick={() => {
                const p = prompt(
                  t(
                    'workspace.setNativePath',
                    'Enter the absolute path to this folder on your machine:',
                  ),
                  activeWorkspace?.nativePath || '',
                );
                if (p === null) return;
                const trimmed = p.trim();
                const err = nativePathValidationError(trimmed);
                if (err) {
                  setNativePathError(err);
                  toast.error(err);
                  return;
                }
                setNativePathError(null);
                if (activeWorkspace) {
                  updateWorkspaceLocalPath(activeWorkspace.id, trimmed);
                  toast.success(t('workspace.nativePathSaved', 'Server path saved successfully'));
                }
              }}
              className="text-[10px] text-lime-500 opacity-0 group-hover:opacity-100 hover:underline transition-opacity"
            >
              {t('common.edit', 'Edit')}
            </button>
          </div>
          <div
            className="text-[10px] font-mono text-muted-foreground truncate"
            title={activeWorkspace?.nativePath || 'Not set'}
          >
            {activeWorkspace?.nativePath ? (
              <span className="text-lime-400">{activeWorkspace.nativePath}</span>
            ) : (
              <span className="italic">{t('workspace.noNativePath', 'No native path set')}</span>
            )}
          </div>
          {nativePathError && (
            <p className="text-[9px] text-red-400 mt-0.5 wrap-break-word">{nativePathError}</p>
          )}
        </div>

        {/* Vector config mapping for indexing & summarization */}
        <div className="mx-2 mb-2 px-2 py-2 rounded-lg bg-muted/30 border border-border/40 group">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-1">
              <DatabaseZap className="h-2.5 w-2.5 text-violet-500" />
              {t('workspace.indexingConfig', 'Indexing Optimization')}
            </span>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input 
              type="checkbox" 
              className="rounded border-border accent-violet-500"
              checked={useSummarization}
              onChange={(e) => setUseSummarization(e.target.checked)}
            />
            {t('workspace.summarizeCheckbox', 'Summarize content & extract keywords')}
          </label>

          {useSummarization && (
            <>
              <label className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1 mt-2">
                 {t('workspace.modelUsed', 'Model used for vectors/summaries:')}
              </label>
              <select
                className="w-full bg-background border border-border rounded px-2 py-1 text-[10px] text-foreground focus:ring-1 focus:ring-violet-500 outline-none mb-2"
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
              >
                <option value="">{t('workspace.selectModel', 'Select a model...')}</option>
                {models.map((model: { id: string; name: string; provider: string }) => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.provider})
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {/* Vector index summary */}
        {indexedCount > 0 && (
          <div className="mx-2 mb-2 px-2 py-1.5 rounded-lg bg-violet-500/8 border border-violet-500/20 text-[10px] text-violet-300 flex items-center gap-1.5">
            <CheckCircle2 className="h-2.5 w-2.5 text-violet-400 shrink-0" />
            <span>{indexedCount} file(s) sent to vector index</span>
          </div>
        )}

        {fileTree ? (
          <WorkspaceFileTree
            nodes={fileTree.children || []}
            onSelect={onSelectNode}
            selectedPath={selectedPath}
            getIndexStatus={getStatus}
            onIndexFile={uploadAndIndex}
            rootHandle={activeWorkspace?.rootHandle}
          />
        ) : (
          <p className="text-xs text-muted-foreground italic px-2 py-3">Loading…</p>
        )}
      </ScrollArea>
      
      <WorkspaceSettings 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </Resizable>
  );
}
