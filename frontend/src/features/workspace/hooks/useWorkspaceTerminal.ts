import { useState, useRef, useEffect, KeyboardEvent, useMemo } from 'react';
import { useWorkspace } from './useWorkspace';
import { useWorkspaceStore } from '../store/workspaceStore';

export function useWorkspaceTerminal() {
  const { executeTerminalCommand } = useWorkspace();
  const terminalHistory = useWorkspaceStore((s) => s.terminalHistory);
  const clearTerminal = useWorkspaceStore((s) => s.clearTerminal);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const terminalWorkspaceId = useWorkspaceStore((s) => s.terminalWorkspaceId);
  const setTerminalWorkspaceId = useWorkspaceStore((s) => s.setTerminalWorkspaceId);

  const [input, setInput] = useState('');
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [suggestionIdx, setSuggestionIdx] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const terminalWs = workspaces.find((w) => w.id === terminalWorkspaceId) ?? workspaces[0] ?? null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalHistory]);

  const suggestions = useMemo(() => {
    if (!input) return [];

    const parts = input.split(' ');
    const isCmd = parts.length === 1;
    const lastPart = parts[parts.length - 1] ?? '';
    let matches: string[] = [];

    if (isCmd) {
      const availableCmds = ['ls', 'cat', 'mkdir', 'echo', 'write', 'clear', 'help'];
      matches = availableCmds.filter((c) => c.startsWith(lastPart));
    } else {
      if (terminalWs?.fileTree?.children) {
        matches = terminalWs.fileTree.children
          .map((c) => c.name)
          .filter((n) => n.startsWith(lastPart));
      }
    }

    if (matches.length === 1 && matches[0] === lastPart) {
      return [];
    }
    return matches;
  }, [input, terminalWs]);

  const handleRun = async () => {
    const cmd = input.trim();
    if (!cmd) return;
    setCmdHistory((h) => [cmd, ...h].slice(0, 200));
    setHistoryIdx(-1);
    setInput('');
    await executeTerminalCommand(cmd);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length > 0) {
      if (e.key === 'Tab') {
        e.preventDefault();
        const parts = input.split(' ');
        parts[parts.length - 1] = suggestions[suggestionIdx];
        setInput(parts.join(' '));
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestionIdx((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestionIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      return;
    }

    if (e.key === 'Enter') {
      handleRun();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(historyIdx + 1, cmdHistory.length - 1);
      setHistoryIdx(next);
      setInput(cmdHistory[next] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(historyIdx - 1, -1);
      setHistoryIdx(next);
      setInput(next === -1 ? '' : (cmdHistory[next] ?? ''));
    }
  };

  const promptStr = terminalWs ? `~/${terminalWs.name}` : '~';

  return {
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
  };
}
