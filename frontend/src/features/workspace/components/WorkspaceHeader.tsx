'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Plus,
  FolderGit2,
  XCircle,
  FolderPlus,
  Clock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useWorkspaceHeaderLogic } from '../hooks/useWorkspaceHeader';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { WorkspaceEntry } from '../store/workspaceStore';
import { SavedWorkspace } from '../services/workspaceStorage';

interface WorkspaceHeaderProps {
  workspaces: WorkspaceEntry[];
  activeWorkspaceId: string | null;
  isDirty: boolean;
  isLoading: boolean;
  recentWorkspaces: SavedWorkspace[];
  switchWorkspace: (id: string) => void;
  closeWorkspace: (id: string) => void;
  openWorkspace: () => void;
  openRecentWorkspace: (ws: SavedWorkspace) => void;
  loadRecentWorkspaces: () => void;
  watcherEnabled: boolean;
  setWatcherEnabled: (enabled: boolean) => void;
}

export function WorkspaceHeader({
  workspaces,
  activeWorkspaceId,
  isDirty,
  isLoading,
  recentWorkspaces,
  switchWorkspace,
  closeWorkspace,
  openWorkspace,
  openRecentWorkspace,
  loadRecentWorkspaces,
  watcherEnabled,
  setWatcherEnabled,
}: WorkspaceHeaderProps) {
  const { t } = useWorkspaceHeaderLogic();

  return (
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
            loadRecentWorkspaces();
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

      <div className="flex-1" />

      {/* Watcher Toggle */}
      <div className="flex items-center gap-2 pr-4 pl-2 border-l border-border/30 h-full">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setWatcherEnabled(!watcherEnabled)}
          className={cn(
            "h-8 gap-2 rounded-lg transition-all",
            watcherEnabled 
              ? "bg-lime-500/10 text-lime-600 dark:text-lime-400 hover:bg-lime-500/20" 
              : "text-muted-foreground hover:bg-muted/50"
          )}
          title={watcherEnabled ? "Watcher Enabled (Auto-refreshing)" : "Watcher Disabled"}
        >
          {watcherEnabled ? (
            <>
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-500"></span>
              </div>
              <Eye className="h-4 w-4" />
              <span className="text-xs font-semibold">Watching</span>
            </>
          ) : (
            <>
              <EyeOff className="h-4 w-4" />
              <span className="text-xs">Watcher</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
