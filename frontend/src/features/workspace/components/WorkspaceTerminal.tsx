'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal, Trash2, X, ChevronDown } from 'lucide-react';
import { useWorkspaceTerminal } from '../hooks/useWorkspaceTerminal';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { TerminalEntry } from '../store/workspaceStore';

const EntryLine = ({ entry }: { entry: TerminalEntry }) => {
  const colors = {
    input: 'text-sky-400 font-mono',
    output: 'text-foreground/90 font-mono whitespace-pre-wrap',
    error: 'text-red-400 font-mono whitespace-pre-wrap',
    info: 'text-amber-400/80 font-mono whitespace-pre-wrap italic',
  };
  return (
    <div className={cn('text-xs leading-relaxed py-0.5', colors[entry.type])}>{entry.text}</div>
  );
};

export function WorkspaceTerminal({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation('common');
  const {
    terminalHistory,
    clearTerminal,
    workspaces,
    terminalWorkspaceId,
    setTerminalWorkspaceId,
    terminalWs,
    input,
    setInput,
    suggestionIdx,
    setSuggestionIdx,
    suggestions,
    bottomRef,
    inputRef,
    handleKeyDown,
    promptStr,
  } = useWorkspaceTerminal();

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 dark:bg-zinc-950 text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-zinc-800 shrink-0 bg-zinc-900">
        <div className="flex items-center gap-2 text-xs text-zinc-400 font-semibold tracking-wide">
          <Terminal className="w-3.5 h-3.5" />
          {t('workspace.terminal.title', 'TERMINAL')}

          {/* Workspace selector */}
          {workspaces.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 ml-1 px-2 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-lime-500/50 hover:text-lime-400 transition-all text-xs font-mono">
                  {terminalWs?.name ?? 'select'}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="min-w-40 bg-zinc-900 border-zinc-700"
              >
                {workspaces.map((ws) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onSelect={() => setTerminalWorkspaceId(ws.id)}
                    className={cn(
                      'font-mono text-xs text-zinc-300 hover:text-lime-400',
                      terminalWorkspaceId === ws.id && 'text-lime-400',
                    )}
                  >
                    {terminalWorkspaceId === ws.id && '› '}
                    {ws.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            terminalWs && (
              <span className="text-zinc-600 normal-case font-mono">— {terminalWs.name}</span>
            )
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-zinc-500 hover:text-zinc-200"
            onClick={clearTerminal}
            title={t('workspace.terminal.clear', 'Clear terminal')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-zinc-500 hover:text-zinc-200"
              onClick={onClose}
              title={t('workspace.terminal.close', 'Close terminal')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Output area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-2 font-mono text-xs cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {terminalHistory.length === 0 && (
          <p className="text-zinc-600 italic text-xs py-1">
            {t('workspace.terminal.empty', 'Type "help" to see available commands.')}
          </p>
        )}
        {terminalHistory.map((entry) => (
          <EntryLine key={entry.id} entry={entry} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div className="relative border-t border-zinc-800 shrink-0 bg-zinc-900">
        {/* Autocomplete Popup */}
        {suggestions.length > 0 && (
          <div className="absolute bottom-full left-10 mb-2 min-w-48 max-w-sm max-h-48 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-800 shadow-xl py-1 md:z-50 flex flex-col hide-scrollbar">
            {suggestions.map((sug, idx) => (
              <div
                key={sug}
                className={cn(
                  'px-3 py-1.5 text-xs font-mono truncate cursor-pointer transition-colors',
                  idx === suggestionIdx
                    ? 'bg-lime-500/20 text-lime-400'
                    : 'text-zinc-300 hover:bg-zinc-700/50',
                )}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep focus
                  const parts = input.split(' ');
                  parts[parts.length - 1] = sug;
                  setInput(parts.join(' ') + ' ');
                  inputRef.current?.focus();
                }}
              >
                {sug}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 px-4 py-2">
          <span className="text-emerald-500 font-mono text-xs whitespace-nowrap shrink-0">
            {promptStr} $
          </span>
          <input
            autoFocus
            ref={inputRef}
            className="flex-1 bg-transparent text-xs font-mono text-foreground outline-none caret-emerald-400 placeholder-zinc-600"
            placeholder={t('workspace.terminal.placeholder', 'Enter command...')}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setSuggestionIdx(0);
            }}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      </div>
    </div>
  );
}
