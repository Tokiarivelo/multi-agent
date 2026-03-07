'use client';

import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';
import { workspaceStorageService, SavedWorkspace } from '../services/workspaceStorage';
import { useWorkspace } from '../hooks/useWorkspace';
import { WorkspaceFileTree } from './WorkspaceFileTree';
import { WorkspaceEditor } from './WorkspaceEditor';
import { WorkspaceTerminal } from './WorkspaceTerminal';
import { Button } from '@/components/ui/button';
import {
  FolderUp,
  FolderOpen,
  Terminal,
  Save,
  XCircle,
  LayoutPanelLeft,
  RefreshCw,
  FolderGit2,
  Plus,
  ChevronDown,
  AlertTriangle,
  FilePlus,
  FolderPlus,
  Clock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Resizable } from 're-resizable';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function LocalWorkspace() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeFilePath = useWorkspaceStore((s) => s.activeFilePath);
  const isDirty = useWorkspaceStore((s) => s.isDirty);
  const isLoading = useWorkspaceStore((s) => s.isLoading);
  const terminalOpen = useWorkspaceStore((s) => s.terminalOpen);
  const terminalWorkspaceId = useWorkspaceStore((s) => s.terminalWorkspaceId);
  const setTerminalOpen = useWorkspaceStore((s) => s.setTerminalOpen);
  const setTerminalWorkspaceId = useWorkspaceStore((s) => s.setTerminalWorkspaceId);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const fileTree = activeWorkspace?.fileTree ?? null;

  const {
    openWorkspace,
    openFile,
    saveFile,
    closeWorkspace,
    switchWorkspace,
    refreshTree,
    requestWorkspacePermission,
    openRecentWorkspace,
    createItem,
  } = useWorkspace();
  const { t } = useTranslation('common');

  const [terminalHeight, setTerminalHeight] = useState(240);
  const [selectedTreePath, setSelectedTreePath] = useState<string | null>(null);
  const [prevActivePath, setPrevActivePath] = useState<string | null>(null);
  const [recentWorkspaces, setRecentWorkspaces] = useState<SavedWorkspace[]>([]);

  if (activeFilePath !== prevActivePath) {
    setPrevActivePath(activeFilePath);
    setSelectedTreePath(activeFilePath);
  }

  useEffect(() => {
    if (workspaces.length === 0) {
      workspaceStorageService.loadRecentWorkspaces().then(setRecentWorkspaces);
    }
  }, [workspaces.length]);

  // Empty state — no workspaces
  if (workspaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-[calc(100vh-8rem)] w-full border border-dashed border-border/60 rounded-xl bg-card/30">
        <LayoutPanelLeft className="h-16 w-16 text-muted-foreground/30 mb-6" />
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-3">
          {t('workspace.title', 'Local Workspace')}
        </h2>
        <p className="text-muted-foreground max-w-md mb-8">
          {t(
            'workspace.description',
            'Select a local folder on your machine to start reading and editing files directly inside the browser. Your changes stay local to your machine.',
          )}
        </p>
        <Button
          onClick={openWorkspace}
          disabled={isLoading}
          size="lg"
          className="rounded-full shadow-lg gap-2 h-12 px-8 mb-6"
        >
          <FolderUp className="h-5 w-5" />
          {isLoading
            ? t('workspace.loading', 'Loading...')
            : t('workspace.openFolder', 'Open Local Folder')}
        </Button>

        {recentWorkspaces.length > 0 && (
          <div className="w-full max-w-sm mt-4 text-left">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
              <Clock className="h-4 w-4" />
              {t('workspace.recent', 'Recent Workspaces')}
            </div>
            <div className="flex flex-col gap-2">
              {recentWorkspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => openRecentWorkspace(ws)}
                  disabled={isLoading}
                  className="flex items-center gap-3 w-full p-3 rounded-lg border border-border/50 bg-background hover:bg-muted/50 transition-colors text-left"
                >
                  <FolderGit2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="truncate text-sm font-medium text-foreground">{ws.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full border border-border/50 rounded-xl overflow-hidden shadow-sm bg-background flex-col">
      {/* ── Workspace Tabs Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-0 border-b border-border/50 bg-muted/20 shrink-0 overflow-x-auto">
        {workspaces.map((ws) => {
          const isActive = ws.id === activeWorkspaceId;
          return (
            <button
              key={ws.id}
              onClick={() => switchWorkspace(ws.id)}
              className={cn(
                'group flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all shrink-0',
                isActive
                  ? 'border-lime-500 text-lime-700 dark:text-lime-400 bg-background'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/50 hover:bg-muted/30',
              )}
            >
              <FolderGit2
                className={cn('h-3.5 w-3.5', isActive ? 'text-lime-500' : 'text-muted-foreground')}
              />
              <span className="max-w-32 truncate">{ws.name}</span>
              {isDirty && isActive && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Unsaved changes" />
              )}
              <span
                className="ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  closeWorkspace(ws.id);
                }}
                title={t('workspace.close', 'Close')}
              >
                <XCircle className="h-3 w-3" />
              </span>
            </button>
          );
        })}

        {/* Add workspace button */}
        <DropdownMenu
          onOpenChange={(open) => {
            if (open) {
              workspaceStorageService.loadRecentWorkspaces().then(setRecentWorkspaces);
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 ml-1 text-muted-foreground hover:text-foreground shrink-0"
              disabled={isLoading}
              title={t('workspace.openFolder', 'Open another folder')}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                openWorkspace();
              }}
              className="gap-2 cursor-pointer font-medium"
            >
              <FolderPlus className="h-4 w-4 text-emerald-500" />
              {t('workspace.menu.addFolder', 'Open Local Folder...')}
            </DropdownMenuItem>
            
            {recentWorkspaces.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="px-2 py-1.5 text-xs text-muted-foreground font-semibold flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  {t('workspace.recent', 'Recent Workspaces')}
                </DropdownMenuLabel>
                {recentWorkspaces.map((ws) => (
                  <DropdownMenuItem
                    key={`tabs-recent-${ws.id}`}
                    className="gap-2 cursor-pointer"
                    onSelect={(e) => {
                      e.preventDefault();
                      openRecentWorkspace(ws);
                    }}
                  >
                    <FolderGit2 className="h-4 w-4 text-emerald-500/70 shrink-0" />
                    <span className="truncate flex-1">{ws.name}</span>
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      {activeWorkspace?.hasPermission === false ? (
        <div className="flex flex-1 items-center justify-center p-8 bg-muted/5">
          <div className="flex flex-col items-center max-w-sm text-center">
            <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-6">
              <AlertTriangle className="h-8 w-8 text-amber-500 opacity-90" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3">
              {t('workspace.needsPermission', 'Access Required')}
            </h3>
            <p className="text-sm text-muted-foreground mb-8">
              {t(
                'workspace.permissionDesc',
                'Your browser requires you to grant permission again to access this folder after a reload.',
              )}
            </p>
            <Button
              size="lg"
              disabled={isLoading}
              onClick={() => requestWorkspacePermission(activeWorkspace.id)}
              className="w-full bg-lime-600 hover:bg-lime-700 text-primary-foreground font-medium shadow-none rounded-xl"
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              {t('workspace.grantPermission', 'Grant Access')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* LEFT SIDEBAR: File Tree */}
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
                    if (name) createItem('file', name, selectedTreePath);
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
                    if (name) createItem('directory', name, selectedTreePath);
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
              </div>
            </div>
            <ScrollArea className="flex-1 p-2 bg-transparent">
              {fileTree ? (
                <WorkspaceFileTree
                  nodes={fileTree.children || []}
                  onSelect={(node) => {
                    setSelectedTreePath(node.path);
                    openFile(node);
                  }}
                  selectedPath={selectedTreePath ?? activeFilePath}
                />
              ) : (
                <p className="text-xs text-muted-foreground italic px-2 py-3">Loading…</p>
              )}
            </ScrollArea>
          </Resizable>

          {/* MAIN: Editor + Terminal */}
          <div className="flex flex-col flex-1 min-w-0 min-h-0 bg-background overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card/30 shrink-0">
              <div className="flex items-center gap-3 overflow-hidden text-sm">
                {activeFilePath ? (
                  <span className="truncate text-foreground/80 font-mono text-xs px-2 py-1 bg-muted/40 rounded-md border border-border/30">
                    {activeFilePath}
                    {isDirty && <span className="text-amber-500 ml-1.5">*</span>}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm italic">
                    {t('workspace.noFile', 'No file selected')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant={isDirty ? 'default' : 'secondary'}
                  size="sm"
                  onClick={saveFile}
                  disabled={!activeFilePath || !isDirty || isLoading}
                  className="gap-1.5 shadow-sm"
                >
                  <Save className="h-4 w-4" />
                  {t('workspace.saveBtn', 'Save')}
                </Button>

                {/* Terminal dropdown — picks target workspace */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={terminalOpen ? 'secondary' : 'ghost'}
                      size="sm"
                      className={cn('gap-1.5', terminalOpen && 'text-emerald-500')}
                    >
                      <Terminal className="h-4 w-4" />
                      {t('workspace.terminal.label', 'Terminal')}
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('workspace.terminal.targetWorkspace', 'Target Workspace')}
                    </div>
                    <DropdownMenuSeparator />
                    {workspaces.map((ws) => (
                      <DropdownMenuItem
                        key={ws.id}
                        onSelect={() => {
                          setTerminalWorkspaceId(ws.id);
                          setTerminalOpen(true);
                        }}
                        className="gap-2"
                      >
                        <FolderGit2
                          className={cn(
                            'h-3.5 w-3.5',
                            terminalWorkspaceId === ws.id
                              ? 'text-lime-500'
                              : 'text-muted-foreground',
                          )}
                        />
                        <span className="flex-1 truncate">{ws.name}</span>
                        {terminalWorkspaceId === ws.id && terminalOpen && (
                          <span className="text-[10px] text-lime-500">active</span>
                        )}
                      </DropdownMenuItem>
                    ))}
                    {terminalOpen && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => setTerminalOpen(false)}
                          className="text-muted-foreground"
                        >
                          {t('workspace.terminal.close', 'Close Terminal')}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Editor */}
            <div
              className="relative w-full bg-[#1e1e1e] dark:bg-[#1e1e1e] overflow-hidden"
              style={{ flex: terminalOpen ? '1 1 0' : '1 1 auto', minHeight: 0 }}
            >
              <WorkspaceEditor />
            </div>

            {/* Terminal Panel */}
            {terminalOpen && (
              <Resizable
                size={{ width: '100%', height: terminalHeight }}
                minHeight={120}
                maxHeight={600}
                enable={{ top: true }}
                onResizeStop={(_e, _dir, _ref, d) =>
                  setTerminalHeight((h) => Math.max(120, h + d.height))
                }
                handleClasses={{
                  top: 'hover:bg-emerald-500/40 bg-border/40 h-1 transition-colors cursor-row-resize z-20',
                }}
                className="border-t border-zinc-800 shrink-0"
              >
                <WorkspaceTerminal onClose={() => setTerminalOpen(false)} />
              </Resizable>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
