'use client';

import React from 'react';
import { useLocalWorkspaceLogic } from '../hooks/useLocalWorkspace';
import { WorkspaceEmptyState } from './WorkspaceEmptyState';
import { WorkspaceHeader } from './WorkspaceHeader';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { WorkspaceContent } from './WorkspaceContent';
import { useWorkspaceWatcher } from '../hooks/useWorkspaceWatcher';

export function LocalWorkspace() {
  useWorkspaceWatcher();
  const {
    workspaces,
    activeWorkspaceId,
    activeFilePath,
    isDirty,
    isLoading,
    terminalOpen,
    terminalWorkspaceId,
    setTerminalOpen,
    setTerminalWorkspaceId,
    updateWorkspaceLocalPath,
    activeWorkspace,
    openWorkspace,
    openFile,
    saveFile,
    closeWorkspace,
    switchWorkspace,
    refreshTree,
    requestWorkspacePermission,
    openRecentWorkspace,
    createItem,
    isClient,
    isApiSupported,
    recentWorkspaces,
    setSelectedFolder,
    selectedTreePath,
    loadRecentWorkspaces,
    watcherEnabled,
    setWatcherEnabled,
  } = useLocalWorkspaceLogic();

  // Empty state — no workspaces
  if (workspaces.length === 0) {
    return (
      <WorkspaceEmptyState
        isLoading={isLoading}
        isApiSupported={isApiSupported}
        recentWorkspaces={recentWorkspaces}
        openWorkspace={openWorkspace}
        openRecentWorkspace={openRecentWorkspace}
        isClient={isClient}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full border border-border/50 rounded-xl overflow-hidden shadow-sm bg-background flex-col">
      {/* ── Workspace Tabs Bar ─────────────────────────────────────────────── */}
      <WorkspaceHeader
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        isDirty={isDirty}
        isLoading={isLoading}
        recentWorkspaces={recentWorkspaces}
        switchWorkspace={switchWorkspace}
        closeWorkspace={closeWorkspace}
        openWorkspace={openWorkspace}
        openRecentWorkspace={openRecentWorkspace}
        loadRecentWorkspaces={loadRecentWorkspaces}
        watcherEnabled={watcherEnabled}
        setWatcherEnabled={setWatcherEnabled}
      />

      {/* ── Main content ──────────────────────────────────────────────────── */}
      {activeWorkspace?.hasPermission === false ? (
        <div className="flex flex-1 items-center justify-center p-8 bg-muted/5">
          <div className="flex flex-col items-center max-w-sm text-center">
            <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-6">
              <span className="text-amber-500 text-2xl font-bold">!</span>
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3">Access Required</h3>
            <p className="text-sm text-muted-foreground mb-8">
              Your browser requires you to grant permission again to access this folder after a reload.
            </p>
            <button
              disabled={isLoading}
              onClick={() => requestWorkspacePermission(activeWorkspace.id)}
              className="px-6 py-2.5 bg-lime-600 hover:bg-lime-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              Grant Access
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* LEFT SIDEBAR: File Tree */}
          <WorkspaceSidebar
            activeWorkspace={activeWorkspace}
            selectedPath={selectedTreePath}
            onSelectNode={(node) => {
              if (node.kind === 'directory') {
                setSelectedFolder(node.path);
              } else {
                setSelectedFolder(null); // Reset manual folder selection when opening a file
                openFile(node);
              }
            }}
            refreshTree={() => refreshTree(activeWorkspaceId)}
            createItem={createItem}
            updateWorkspaceLocalPath={updateWorkspaceLocalPath}
          />

          {/* MAIN: Editor + Terminal */}
          <WorkspaceContent
            activeFilePath={activeFilePath}
            isDirty={isDirty}
            isLoading={isLoading}
            saveFile={saveFile}
            terminalOpen={terminalOpen}
            setTerminalOpen={setTerminalOpen}
            terminalWorkspaceId={terminalWorkspaceId}
            setTerminalWorkspaceId={setTerminalWorkspaceId}
            workspaces={workspaces}
          />
        </div>
      )}
    </div>
  );
}
