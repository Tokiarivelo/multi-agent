'use client';

import { cn } from '@/lib/utils';

interface DocServiceCardProps {
  title: string;
  description: string;
  className?: string;
}

export function DocServiceCard({ title, description, className }: DocServiceCardProps) {
  return (
    <div
      className={cn(
        'bg-card/50 p-6 rounded-xl border border-border/50 hover:border-primary/30 transition-all shadow-sm',
        className,
      )}
    >
      <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground leading-relaxed text-sm">{description}</p>
    </div>
  );
}
