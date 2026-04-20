'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

type Accent = 'amber' | 'violet' | 'sky' | 'emerald' | 'neutral';

const ACCENT_MAP: Record<Accent, string> = {
  amber: 'text-amber-500 border-amber-500/20 bg-amber-500/5',
  violet: 'text-violet-500 border-violet-500/20 bg-violet-500/5',
  sky: 'text-sky-500 border-sky-500/20 bg-sky-500/5',
  emerald: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5',
  neutral: 'text-muted-foreground border-border/40 bg-muted/20',
};

export interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  accent?: Accent;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleSection({
  title,
  icon,
  accent = 'neutral',
  count,
  children,
  defaultOpen = true,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-lg border ${ACCENT_MAP[accent]} overflow-hidden`}>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        <span className="text-xs font-semibold flex-1">{title}</span>
        {count !== undefined && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-current/10 opacity-70 font-mono">
            {count}
          </span>
        )}
        {open ? (
          <ChevronDown className="h-3 w-3 opacity-60" />
        ) : (
          <ChevronRight className="h-3 w-3 opacity-60" />
        )}
      </button>
      {open && <div className="px-3 pb-3 pt-1 border-t border-current/10">{children}</div>}
    </div>
  );
}
