import * as React from 'react';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────
   Minimal accessible ScrollArea
   Uses a simple overflow-y-auto wrapper.
   Swap for @radix-ui/react-scroll-area if needed.
────────────────────────────────────────────────── */

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('relative overflow-y-auto', className)} {...props}>
      {children}
    </div>
  ),
);
ScrollArea.displayName = 'ScrollArea';

export { ScrollArea };
