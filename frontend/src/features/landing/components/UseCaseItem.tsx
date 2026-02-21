'use client';

interface UseCaseItemProps {
  title: string;
  description: string;
}

export function UseCaseItem({ title, description }: UseCaseItemProps) {
  return (
    <div>
      <h4 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-primary rounded-full" />
        {title}
      </h4>
      <p className="text-muted-foreground text-sm leading-relaxed pl-3.5 border-l border-border/50">
        {description}
      </p>
    </div>
  );
}
