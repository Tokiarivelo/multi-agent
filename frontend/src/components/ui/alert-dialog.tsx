'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog';

/* ─────────────────────────────────────────────────────────
   AlertDialog — confirmation variant of Dialog
   Built on the custom Dialog primitive.
───────────────────────────────────────────────────────── */

interface AlertDialogContextValue {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(null);

// ─── Root ────────────────────────────────────────────────

interface AlertDialogProps {
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  children: React.ReactNode;
}

function AlertDialog({ open, onOpenChange, children }: AlertDialogProps) {
  const [internal, setInternal] = React.useState(false);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : internal;

  const handleChange = (v: boolean) => {
    if (!controlled) setInternal(v);
    onOpenChange?.(v);
  };

  return (
    <AlertDialogContext.Provider value={{ open: isOpen, onOpenChange: handleChange }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

// ─── Trigger ─────────────────────────────────────────────

function AlertDialogTrigger({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  const ctx = React.useContext(AlertDialogContext)!;
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

// ─── Content ─────────────────────────────────────────────

function AlertDialogContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  const ctx = React.useContext(AlertDialogContext)!;
  return (
    <Dialog open={ctx.open} onOpenChange={ctx.onOpenChange}>
      <DialogContent className={cn('sm:max-w-[425px]', className)} {...props}>
        {children}
      </DialogContent>
    </Dialog>
  );
}

// ─── Re-export sub-parts ─────────────────────────────────

const AlertDialogHeader = DialogHeader;
const AlertDialogTitle = DialogTitle;
const AlertDialogDescription = DialogDescription;
const AlertDialogFooter = DialogFooter;

function AlertDialogCancel({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) {
  const ctx = React.useContext(AlertDialogContext)!;
  return (
    <button
      type="button"
      onClick={() => ctx.onOpenChange(false)}
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium',
        'border border-border/60 bg-background/50 hover:bg-muted/50 transition-colors',
        className,
      )}
      {...props}
    >
      {children ?? 'Cancel'}
    </button>
  );
}

function AlertDialogAction({
  children,
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) {
  const ctx = React.useContext(AlertDialogContext)!;
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick?.(e);
        ctx.onOpenChange(false);
      }}
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium',
        'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm',
        className,
      )}
      {...props}
    >
      {children ?? 'Confirm'}
    </button>
  );
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
};
