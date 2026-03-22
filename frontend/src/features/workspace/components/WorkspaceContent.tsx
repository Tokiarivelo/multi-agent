'use client';

import React from 'react';
import { Save, Terminal, ChevronDown, FolderGit2 } from 'lucide-react';
import { Resizable } from 're-resizable';
import { useWorkspaceContentLogic } from '../hooks/useWorkspaceContent';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { WorkspaceEditor } from './WorkspaceEditor';
import { WorkspaceTerminal } from './WorkspaceTerminal';
import { WorkspaceEntry } from '../store/workspaceStore';

interface WorkspaceContentProps {
  activeFilePath: string | null;
  isDirty: boolean;
  isLoading: boolean;
  saveFile: () => void;
  terminalOpen: boolean;
  setTerminalOpen: (open: boolean) => void;
  terminalWorkspaceId: string | null;
  setTerminalWorkspaceId: (id: string | null) => void;
  workspaces: WorkspaceEntry[];
}

export function WorkspaceContent({
  activeFilePath,
  isDirty,
  isLoading,
  saveFile,
  terminalOpen,
  setTerminalOpen,
  terminalWorkspaceId,
  setTerminalWorkspaceId,
  workspaces,
}: WorkspaceContentProps) {
  const { t, terminalHeight, setTerminalHeight } = useWorkspaceContentLogic();

  return (
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
            setTerminalHeight((h: number) => Math.max(120, h + d.height))
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
  );
}
