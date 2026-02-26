'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

/* ─────────────────────────────────────────────────────────
   Lightweight Dialog — portal + backdrop + animated content
   No Radix needed; compatible with dark/light themes.
───────────────────────────────────────────────────────── */

interface DialogContextValue {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

// ─── Root ────────────────────────────────────────────────

interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open, defaultOpen = false, onOpenChange, children }: DialogProps) {
  const [internal, setInternal] = React.useState(defaultOpen);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : internal;

  const handleChange = React.useCallback(
    (v: boolean) => {
      if (!controlled) setInternal(v);
      onOpenChange?.(v);
    },
    [controlled, onOpenChange],
  );

  return (
    <DialogContext.Provider value={{ open: isOpen, onOpenChange: handleChange }}>
      {children}
    </DialogContext.Provider>
  );
}

// ─── Trigger ─────────────────────────────────────────────

function DialogTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const ctx = React.useContext(DialogContext)!;
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
      onClick: () => ctx.onOpenChange(true),
    });
  }
  return (
    <button type="button" onClick={() => ctx.onOpenChange(true)}>
      {children}
    </button>
  );
}

// ─── Portal / Overlay ────────────────────────────────────

function DialogOverlay({ className }: { className?: string }) {
  const ctx = React.useContext(DialogContext)!;
  if (!ctx.open) return null;
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm',
        'animate-in fade-in-0',
        className,
      )}
      onClick={() => ctx.onOpenChange(false)}
    />
  );
}

// ─── Content ─────────────────────────────────────────────

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

function DialogContent({ className, children, ...props }: DialogContentProps) {
  const ctx = React.useContext(DialogContext)!;
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ctx.onOpenChange(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [ctx]);

  if (!ctx.open || !mounted) return null;

  return createPortal(
    <>
      <DialogOverlay />
      <div
        role="dialog"
        aria-modal
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-full max-h-[90vh] overflow-y-auto',
          'bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl shadow-black/20',
          'animate-in fade-in-0 zoom-in-95',
          'p-6',
          className,
        )}
        {...props}
      >
        {children}
        <button
          type="button"
          onClick={() => ctx.onOpenChange(false)}
          className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </>,
    document.body,
  );
}

// ─── Header / Title / Description ────────────────────────

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 text-left mb-4', className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
  );
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6',
        className,
      )}
      {...props}
    />
  );
}

function DialogClose({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const ctx = React.useContext(DialogContext)!;
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
      onClick: () => ctx.onOpenChange(false),
    });
  }
  return (
    <button type="button" onClick={() => ctx.onOpenChange(false)}>
      {children}
    </button>
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
};
