'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronRight,
  ChevronDown,
  FileJson,
  Type,
  Hash,
  ToggleLeft,
  List,
  Code2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

// ─── Utility: parse ONE level of stringified JSON (no recursion) ─────────────
export function deepParse(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // Not JSON — keep as string
      }
    }
    return value;
  }
  return value;
}

// ─── Type Icon ────────────────────────────────────────────────────────────────
export function getTypeIcon(value: unknown) {
  if (value === null) return <FileJson className="h-3 w-3 text-muted-foreground/60" />;
  if (Array.isArray(value)) return <List className="h-3 w-3 text-sky-400" />;
  if (typeof value === 'object') return <FileJson className="h-3 w-3 text-violet-400" />;
  if (typeof value === 'string') return <Type className="h-3 w-3 text-emerald-400" />;
  if (typeof value === 'number') return <Hash className="h-3 w-3 text-blue-400" />;
  if (typeof value === 'boolean') return <ToggleLeft className="h-3 w-3 text-amber-400" />;
  return <Code2 className="h-3 w-3 text-muted-foreground/60" />;
}

// ─── Tree Item — renders ONE row + children on expand ────────────────────────
interface TreeItemProps {
  name: string;
  value: unknown;
  path: string[];
  selectedPath: string[];
  onSelect: (path: string[]) => void;
  level?: number;
}

function TreeItem({ name, value, path, selectedPath, onSelect, level = 0 }: TreeItemProps) {
  const isObject = value !== null && typeof value === 'object';
  const childCount = isObject ? Object.keys(value as Record<string, unknown>).length : 0;
  // Only expand the very first level by default to avoid massive renders
  const [expanded, setExpanded] = useState(level === 0 && childCount <= 10);
  const isSelected = selectedPath.join('\x00') === path.join('\x00');

  const handleRowClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(path);
    },
    [onSelect, path],
  );

  const toggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((v) => !v);
  }, []);

  return (
    <div className="w-full select-none">
      <div
        className={cn(
          'flex items-center gap-1.5 py-1 pr-2 hover:bg-muted/50 cursor-pointer rounded-sm text-xs transition-colors',
          isSelected
            ? 'bg-primary/10 text-primary hover:bg-primary/15 font-medium'
            : 'text-foreground/80',
        )}
        style={{ paddingLeft: `${level * 12 + 6}px` }}
        onClick={handleRowClick}
      >
        {/* Expand toggle or leaf icon */}
        {isObject ? (
          <button
            onClick={toggleExpand}
            className="p-0.5 hover:bg-muted/80 rounded shrink-0 transition-colors text-muted-foreground"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            {getTypeIcon(value)}
          </span>
        )}

        <span className="truncate flex-1 font-mono text-[11px]">{name}</span>

        {/* Count badge for objects/arrays */}
        {isObject && childCount > 0 && (
          <span className="text-[9px] px-1 rounded bg-muted/60 text-muted-foreground font-mono shrink-0">
            {Array.isArray(value) ? `[${childCount}]` : `{${childCount}}`}
          </span>
        )}

        {/* Inline preview for leaf primitives */}
        {!isObject && (
          <span className="text-[10px] truncate max-w-[80px] opacity-50 font-mono shrink-0">
            {typeof value === 'string'
              ? `"${value.slice(0, 18)}${value.length > 18 ? '…' : ''}"`
              : String(value)}
          </span>
        )}
      </div>

      {isObject && expanded && (
        <div className="border-l border-border/30 ml-[17px]">
          {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
            <TreeItem
              key={k}
              name={k}
              value={v}
              path={[...path, k]}
              selectedPath={selectedPath}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Value Renderer — renders the RIGHT pane value ────────────────────────────
// NOTE: No recursive <StructuredDataViewer> here — nested objects render as
// collapsible JSON to avoid infinite render cycles.
interface ValueRendererProps {
  value: unknown;
}

function ValueRenderer({ value }: ValueRendererProps) {
  if (value === null) return <span className="text-muted-foreground/60 italic font-mono">null</span>;
  if (value === undefined)
    return <span className="text-muted-foreground/60 italic font-mono">undefined</span>;

  if (typeof value === 'boolean') {
    return (
      <span
        className={cn(
          'font-mono font-semibold px-2 py-0.5 rounded text-sm',
          value ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500',
        )}
      >
        {value ? 'true' : 'false'}
      </span>
    );
  }

  if (typeof value === 'number') {
    return (
      <span className="font-mono text-blue-400 text-sm bg-blue-500/5 px-2 py-0.5 rounded">
        {value}
      </span>
    );
  }

  if (typeof value === 'string') {
    const looksLikeMarkdown =
      value.includes('\n') ||
      value.includes('```') ||
      value.includes('# ') ||
      value.includes('**') ||
      value.includes('| ') ||
      value.includes('- ');
    if (looksLikeMarkdown) {
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted/40 prose-pre:text-[11px] prose-code:text-[11px] prose-headings:font-semibold">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
        </div>
      );
    }
    return (
      <span className="text-foreground/90 text-sm whitespace-pre-wrap leading-relaxed break-all">
        {value}
      </span>
    );
  }

  // Arrays and Objects: render as formatted JSON (no recursive viewer)
  return (
    <pre className="text-[11px] font-mono whitespace-pre-wrap break-all text-foreground/80 bg-muted/20 p-4 rounded-md border border-border/50 w-full overflow-auto max-h-[380px]">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export interface StructuredDataViewerProps {
  data: unknown;
  className?: string;
  /** Automatically parse stringified JSON root. Defaults to true. */
  autoParse?: boolean;
}

export function StructuredDataViewer({
  data,
  className,
  autoParse = true,
}: StructuredDataViewerProps) {
  const [selectedPath, setSelectedPath] = useState<string[]>([]);

  // Only parse at the top level — no deep recursion
  const resolved = useMemo(() => (autoParse ? deepParse(data) : data), [data, autoParse]);

  const getDataAtPath = useCallback(
    (path: string[]): unknown => {
      let current = resolved;
      for (const key of path) {
        if (current === undefined || current === null) return current;
        current = (current as Record<string, unknown>)[key];
      }
      return current;
    },
    [resolved],
  );

  const handleSelect = useCallback((path: string[]) => {
    setSelectedPath(path);
  }, []);

  const isObject = resolved !== null && typeof resolved === 'object';

  // Non-object: just render inline
  if (!isObject) {
    return (
      <div className={cn('p-4 border border-border/50 rounded-md bg-background/50', className)}>
        <ValueRenderer value={resolved} />
      </div>
    );
  }

  const selectedValue = selectedPath.length > 0 ? getDataAtPath(selectedPath) : resolved;
  const entries = Object.entries(resolved as Record<string, unknown>);

  return (
    <div
      className={cn(
        'flex flex-col md:flex-row border border-border/50 rounded-md overflow-hidden bg-background',
        className,
      )}
    >
      {/* ── Left: Tree Menu ── */}
      <div className="w-full md:w-[36%] border-b md:border-b-0 md:border-r border-border/50 bg-muted/5 flex flex-col min-h-[200px]">
        <div className="px-3 py-2 border-b border-border/50 bg-muted/20 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Structure
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[9px] px-2 text-muted-foreground"
            onClick={() => setSelectedPath([])}
          >
            Root
          </Button>
        </div>
        <ScrollArea className="flex-1 max-h-[300px] md:max-h-[440px]">
          <div className="py-1.5">
            {entries.map(([k, v]) => (
              <TreeItem
                key={k}
                name={k}
                value={v}
                path={[k]}
                selectedPath={selectedPath}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* ── Right: Value Viewer ── */}
      <div className="w-full md:w-[64%] flex flex-col bg-background/30">
        <div className="px-3 py-2 border-b border-border/50 bg-muted/20 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5 truncate">
            <Code2 className="h-3 w-3 shrink-0" />
            <span className="truncate font-mono">
              {selectedPath.length > 0 ? selectedPath.join(' › ') : 'Root Object'}
            </span>
          </span>
          <span className="text-[9px] shrink-0 bg-muted/60 px-1.5 py-0.5 rounded text-muted-foreground border border-border/40 font-mono ml-2">
            {selectedValue === null
              ? 'null'
              : Array.isArray(selectedValue)
                ? `array[${(selectedValue as unknown[]).length}]`
                : typeof selectedValue}
          </span>
        </div>
        <ScrollArea className="flex-1 max-h-[380px] md:max-h-[440px]">
          <div className="p-4">
            <ValueRenderer value={selectedValue} />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
