'use client';

import { useState, useEffect, useReducer } from 'react';
import { BookOpen, X, ExternalLink, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownViewer } from './MarkdownViewer';
import { cn } from '@/lib/utils';

interface DocSection {
  id: string;
  label: string;
  /** Heading text to match (substring, case-insensitive) */
  heading: string;
}

interface DocPanelProps {
  /** Public path to the markdown file, e.g. /docs/orchestrator-node.md */
  docPath: string;
  title: string;
  /** Optional quick-jump sections extracted from headings */
  sections?: DocSection[];
  /** Trigger element — defaults to an icon button */
  trigger?: React.ReactNode;
  /** Extra className on the trigger wrapper */
  className?: string;
}

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; content: string }
  | { status: 'error'; message: string };

type FetchAction =
  | { type: 'start' }
  | { type: 'success'; content: string }
  | { type: 'failure'; message: string };

function fetchReducer(_state: FetchState, action: FetchAction): FetchState {
  switch (action.type) {
    case 'start':   return { status: 'loading' };
    case 'success': return { status: 'done', content: action.content };
    case 'failure': return { status: 'error', message: action.message };
  }
}

export function DocPanel({ docPath, title, sections, trigger, className }: DocPanelProps) {
  const [open, setOpen] = useState(false);
  const [fetchState, dispatch] = useReducer(fetchReducer, { status: 'idle' });
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const content = fetchState.status === 'done' ? fetchState.content : null;
  const loading = fetchState.status === 'loading';
  const error = fetchState.status === 'error' ? fetchState.message : null;

  useEffect(() => {
    if (!open || fetchState.status !== 'idle') return;
    let cancelled = false;
    dispatch({ type: 'start' });
    fetch(docPath)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load docs (${r.status})`);
        return r.text();
      })
      .then((text) => {
        if (!cancelled) dispatch({ type: 'success', content: text });
      })
      .catch((e: unknown) => {
        if (!cancelled) dispatch({ type: 'failure', message: e instanceof Error ? e.message : 'Unknown error' });
      });
    return () => { cancelled = true; };
  }, [open, docPath, fetchState.status]);

  // Derive sections from content if not provided
  const derivedSections: DocSection[] = sections ?? deriveH2Sections(content ?? '');

  const scrollToSection = (heading: string) => {
    const id = heading
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  };

  return (
    <>
      {/* Trigger */}
      <span className={cn('inline-flex', className)} onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Tutorial &amp; Docs
          </Button>
        )}
      </span>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in panel */}
      <div
        className={cn(
          'fixed top-0 right-0 z-[70] h-full w-[720px] max-w-[95vw]',
          'bg-background border-l border-border shadow-2xl',
          'flex flex-col transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-indigo-500" />
            <span className="font-semibold text-sm">{title}</span>
            <a
              href={docPath}
              target="_blank"
              rel="noopener noreferrer"
              title="Open raw file"
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Table of contents */}
          {derivedSections.length > 0 && (
            <nav className="w-44 shrink-0 border-r border-border/40 overflow-y-auto py-3 px-2 space-y-0.5">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-2 pb-1">
                Contents
              </p>
              {derivedSections.map((s) => {
                const id = s.heading
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-|-$/g, '');
                const isActive = activeSection === id;
                return (
                  <button
                    key={s.id}
                    onClick={() => scrollToSection(s.heading)}
                    className={cn(
                      'w-full flex items-center gap-1.5 text-left text-[11px] px-2 py-1 rounded-md transition-colors truncate',
                      isActive
                        ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                    )}
                  >
                    <ChevronRight className={cn('h-2.5 w-2.5 shrink-0', isActive && 'text-indigo-500')} />
                    <span className="truncate">{s.label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-5">
              {loading && (
                <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading documentation…</span>
                </div>
              )}
              {error && (
                <div className="flex items-start gap-2 p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Failed to load docs</p>
                    <p className="text-xs mt-0.5 text-muted-foreground">{error}</p>
                  </div>
                </div>
              )}
              {content && !loading && (
                <MarkdownViewer content={addHeadingIds(content)} />
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveH2Sections(markdown: string): DocSection[] {
  const lines = markdown.split('\n');
  return lines
    .filter((l) => l.startsWith('## '))
    .map((l) => {
      const heading = l.replace(/^## /, '').trim();
      const id = heading
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      return { id, label: heading, heading };
    });
}

/**
 * Inject HTML id attributes onto h2 headings so in-page anchor scrolling works.
 * react-markdown renders headings as plain <h2> with no id — we pre-process the
 * markdown by replacing ## headings with an HTML anchor tag above them.
 */
function addHeadingIds(markdown: string): string {
  return markdown.replace(/^(#{1,4}) (.+)$/gm, (_, hashes: string, text: string) => {
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${hashes} <span id="${id}"></span>${text}`;
  });
}
