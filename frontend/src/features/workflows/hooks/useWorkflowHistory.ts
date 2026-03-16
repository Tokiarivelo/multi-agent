'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type { AddNodePayload, AddEdgePayload } from '../api/workflows.api';

// ─── Action types ────────────────────────────────────────────────────────────
export type HistoryEntry =
  | { op: 'node_added'; node: AddNodePayload }
  | { op: 'node_deleted'; node: AddNodePayload; connectedEdges: AddEdgePayload[] }
  | {
      op: 'node_updated';
      nodeId: string;
      before: Partial<AddNodePayload>;
      after: Partial<AddNodePayload>;
    }
  | { op: 'edge_added'; edge: AddEdgePayload }
  | { op: 'edge_deleted'; edge: AddEdgePayload };

interface Options {
  /** Called with the entry to reverse (undo direction) */
  onUndo: (entry: HistoryEntry) => void;
  /** Called with the entry to re-apply (redo direction) */
  onRedo: (entry: HistoryEntry) => void;
  /** Max entries to keep in each stack */
  maxSize?: number;
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useWorkflowHistory({ onUndo, onRedo, maxSize = 50 }: Options) {
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  // Expose sizes as state so consumers can use canUndo/canRedo reactively
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const sync = () => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  };

  /** Push a new action — clears the redo stack */
  const push = useCallback(
    (entry: HistoryEntry) => {
      undoStack.current = [...undoStack.current.slice(-(maxSize - 1)), entry];
      redoStack.current = [];
      sync();
    },
    [maxSize],
  );

  const undo = useCallback(() => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    redoStack.current.push(entry);
    sync();
    onUndo(entry);
  }, [onUndo]);

  const redo = useCallback(() => {
    const entry = redoStack.current.pop();
    if (!entry) return;
    undoStack.current.push(entry);
    sync();
    onRedo(entry);
  }, [onRedo]);

  /** Global keyboard handler — skips when focus is in an editor / input */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip when typing in an input, textarea, select, or Monaco editor (contenteditable)
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable = (e.target as HTMLElement)?.isContentEditable;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || isEditable) return;

      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  return { push, undo, redo, canUndo, canRedo };
}
