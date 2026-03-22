'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { LayoutPanelLeft, FolderUp, AlertTriangle, Clock, FolderGit2 } from 'lucide-react';
import { useWorkspaceEmptyStateLogic } from '../hooks/useWorkspaceEmptyState';
import { SavedWorkspace } from '../services/workspaceStorage';

interface WorkspaceEmptyStateProps {
  isLoading: boolean;
  isApiSupported: boolean;
  recentWorkspaces: SavedWorkspace[];
  openWorkspace: () => void;
  openRecentWorkspace: (ws: SavedWorkspace) => void;
  isClient: boolean;
}

export function WorkspaceEmptyState({
  isLoading,
  isApiSupported,
  recentWorkspaces,
  openWorkspace,
  openRecentWorkspace,
  isClient,
}: WorkspaceEmptyStateProps) {
  const { t } = useWorkspaceEmptyStateLogic();

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

      {isClient && !isApiSupported && (
        <div className="flex items-start gap-3 p-4 mb-8 max-w-md bg-amber-500/10 border border-amber-500/20 rounded-xl text-left">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-1">
              {t('workspace.apiNotSupported', 'Browser Not Supported')}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t(
                'workspace.apiNotSupportedDesc',
                'Your browser does not support local directory access. Please use a Chromium-based browser like Chrome or Edge for this feature.',
              )}
            </p>
          </div>
        </div>
      )}

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
