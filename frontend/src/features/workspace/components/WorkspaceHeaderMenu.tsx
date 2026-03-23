'use client';

import React from 'react';
import {
  FolderOpen,
  FolderPlus,
  ChevronDown,
  X,
  Check,
  HardDrive,
  FolderGit2,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWorkspaceHeaderMenuLogic } from '../hooks/useWorkspaceHeaderMenu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { NativePathSetupDialog } from './NativePathSetupDialog';

export function WorkspaceHeaderMenu() {
  const {
    t,
    workspaces,
    activeWorkspaceId,
    isLoading,
    openWorkspace,
    closeWorkspace,
    switchWorkspace,
    requestWorkspacePermission,
    openRecentWorkspace,
    recentWorkspaces,
    pathDialogWs,
    setPathDialogWs,
    count,
  } = useWorkspaceHeaderMenuLogic();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'gap-2 h-8 px-3 text-sm font-medium rounded-lg border border-transparent',
              'hover:bg-muted/60 hover:border-border/50 transition-all',
              count > 0 && 'text-lime-600 dark:text-lime-400 border-lime-500/20 bg-lime-500/5',
            )}
          >
            <FolderGit2 className="h-4 w-4" />
            <span className="hidden sm:inline">
              {count === 0
                ? t('workspace.menu.noWorkspace', 'No Workspace')
                : count === 1
                  ? workspaces[0].name
                  : t('workspace.menu.count', `${count} Workspaces`, { count })}
            </span>
            {count > 0 && (
              <Badge
                variant="secondary"
                className="h-4 min-w-4 px-1 text-[10px] font-bold bg-lime-500/20 text-lime-600 dark:text-lime-400 border-0"
              >
                {count}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-80 p-1">
          <DropdownMenuLabel className="flex items-center justify-between px-2 py-1.5">
            <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <HardDrive className="h-3.5 w-3.5" />
              {t('workspace.menu.title', 'Workspaces')}
            </span>
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              {count} open
            </Badge>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {/* Workspace list */}
          {count === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
              {t('workspace.menu.empty', 'No folder opened yet')}
            </div>
          ) : (
            workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspaceId;
              const needsPermission = ws.hasPermission === false;
              const hasPath = !!ws.nativePath;

              return (
                <div
                  key={ws.id}
                  className={cn(
                    'group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors',
                    isActive
                      ? 'bg-lime-500/10 text-lime-700 dark:text-lime-400'
                      : 'hover:bg-muted/60',
                    needsPermission && 'opacity-75',
                  )}
                  onClick={() => {
                    if (needsPermission) {
                      requestWorkspacePermission(ws.id);
                    } else {
                      switchWorkspace(ws.id);
                    }
                  }}
                >
                  {needsPermission ? (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  ) : (
                    <FolderOpen
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        isActive ? 'text-lime-500' : 'text-muted-foreground',
                      )}
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-sm font-medium truncate',
                        needsPermission && 'text-amber-600 dark:text-amber-500',
                      )}
                    >
                      {ws.name}
                    </p>
                    <p className="text-[10px] truncate">
                      {needsPermission ? (
                        <span className="text-amber-500">
                          {t('workspace.clickToRestore', 'Click to restore access')}
                        </span>
                      ) : hasPath ? (
                        <span className="text-lime-500 font-mono">{ws.nativePath}</span>
                      ) : (
                        <span className="text-muted-foreground italic">
                          {t('workspace.noServerPath', 'No server path — click ⚙ to set')}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Set server path button — pulses amber when not yet configured */}
                  <button
                    className={cn(
                      'p-0.5 rounded transition-all',
                      hasPath
                        ? 'text-lime-500 opacity-0 group-hover:opacity-100 hover:bg-lime-500/10'
                        : 'text-amber-500 opacity-100 hover:bg-amber-500/10 animate-pulse',
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPathDialogWs({ id: ws.id, name: ws.name });
                    }}
                    title={t('workspace.setServerPath', 'Set server path')}
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </button>

                  {isActive && !needsPermission && (
                    <Check className="h-3.5 w-3.5 text-lime-500 shrink-0" />
                  )}

                  <button
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeWorkspace(ws.id);
                      toast.info(t('workspace.closed', `"${ws.name}" closed`));
                    }}
                    title={t('workspace.close', 'Close workspace')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}

          {/* Recent Workspaces section */}
          {recentWorkspaces.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="px-2 py-1.5 text-xs text-muted-foreground font-semibold">
                {t('workspace.menu.recent', 'Recent')}
              </DropdownMenuLabel>
              {recentWorkspaces.map((ws) => (
                <DropdownMenuItem
                  key={`recent-${ws.id}`}
                  className="gap-2 cursor-pointer"
                  onSelect={(e: Event) => {
                    e.preventDefault();
                    openRecentWorkspace(ws);
                  }}
                >
                  <FolderGit2 className="h-4 w-4 text-emerald-500/70" />
                  <span className="truncate flex-1">{ws.name}</span>
                </DropdownMenuItem>
              ))}
            </>
          )}

          <DropdownMenuSeparator />

          {/* Open new folder */}
          <DropdownMenuItem
            disabled={isLoading}
            onSelect={(e: Event) => {
              e.preventDefault();
              openWorkspace();
            }}
            className="gap-2 text-sm font-medium"
          >
            <FolderPlus className="h-4 w-4 text-lime-500" />
            {isLoading
              ? t('workspace.loading', 'Loading...')
              : t('workspace.menu.addFolder', 'Open New Folder…')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Native path setup dialog — rendered outside dropdown to avoid z-index clipping */}
      {pathDialogWs && (
        <NativePathSetupDialog
          workspaceId={pathDialogWs.id}
          workspaceName={pathDialogWs.name}
          open={!!pathDialogWs}
          onOpenChange={(open) => {
            if (!open) setPathDialogWs(null);
          }}
        />
      )}
    </>
  );
}
