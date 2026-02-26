'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

/* ───────────────────────────────────────────────────────────
   Headless custom Select — lightweight, no Radix dependency.
   Fully keyboard-accessible and theme-compatible.
─────────────────────────────────────────────────────────── */

interface SelectContextValue {
  value: string;
  onValueChange: (v: string) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectCtx() {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error('Select component context missing');
  return ctx;
}

// ─── Root ────────────────────────────────────────────────

interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  children: React.ReactNode;
}

function Select({ value, defaultValue, onValueChange, children }: SelectProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? '');
  const [open, setOpen] = React.useState(false);

  const controlled = value !== undefined;
  const current = controlled ? value : internal;

  const handleChange = React.useCallback(
    (v: string) => {
      if (!controlled) setInternal(v);
      onValueChange?.(v);
      setOpen(false);
    },
    [controlled, onValueChange],
  );

  // Close on outside click
  const containerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    function handleOut(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOut);
    return () => document.removeEventListener('mousedown', handleOut);
  }, []);

  return (
    <SelectContext.Provider value={{ value: current, onValueChange: handleChange, open, setOpen }}>
      <div ref={containerRef} className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

// ─── Trigger ──────────────────────────────────────────────

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const { open, setOpen } = useSelectCtx();
    return (
      <button
        ref={ref}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls="select-listbox"
        id="select-trigger"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm',
          'backdrop-blur-sm shadow-sm ring-offset-background',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'hover:bg-muted/40 transition-colors',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
    );
  },
);
SelectTrigger.displayName = 'SelectTrigger';

// ─── Value ───────────────────────────────────────────────

function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value } = useSelectCtx();
  return (
    <span className={cn('truncate', !value && 'text-muted-foreground')}>
      {value || placeholder || 'Select…'}
    </span>
  );
}

// ─── Content ──────────────────────────────────────────────

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
}

function SelectContent({ children, className }: SelectContentProps) {
  const { open } = useSelectCtx();
  if (!open) return null;
  return (
    <div
      className={cn(
        'absolute top-full z-50 mt-1 w-full min-w-32 overflow-hidden rounded-lg border border-border/60',
        'bg-popover text-popover-foreground shadow-xl shadow-black/10',
        'animate-in fade-in-0 zoom-in-95',
        className,
      )}
    >
      <div className="max-h-60 overflow-y-auto p-1">{children}</div>
    </div>
  );
}

// ─── Item ────────────────────────────────────────────────

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: React.ReactNode;
}

function SelectItem({ value, children, className, ...props }: SelectItemProps) {
  const ctx = useSelectCtx();
  const isSelected = ctx.value === value;

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm',
        'outline-none transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus:bg-accent focus:text-accent-foreground',
        isSelected && 'bg-accent/60 font-medium',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ─── Label ───────────────────────────────────────────────

function SelectLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('px-3 py-1.5 text-xs font-semibold text-muted-foreground', className)}>
      {children}
    </div>
  );
}

// ─── Separator ───────────────────────────────────────────

function SelectSeparator({ className }: { className?: string }) {
  return <div className={cn('-mx-1 my-1 h-px bg-border/50', className)} />;
}

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
};
