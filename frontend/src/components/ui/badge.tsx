import * as React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variantClasses = {
      default: 'border-transparent bg-primary/10 text-primary hover:bg-primary/20',
      secondary:
        'border-transparent bg-secondary/80 text-secondary-foreground hover:bg-secondary/60',
      destructive: 'border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20',
      outline: 'text-foreground border-border/60',
      success:
        'border-transparent bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20',
      warning:
        'border-transparent bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/20',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          variantClasses[variant],
          className,
        )}
        {...props}
      />
    );
  },
);
Badge.displayName = 'Badge';

export { Badge };
