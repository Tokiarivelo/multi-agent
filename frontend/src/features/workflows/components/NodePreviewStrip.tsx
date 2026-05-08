'use client';

import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { getNodeTypeMeta } from './nodeTypes';
import { WorkflowNode } from '@/types';

interface NodePreviewStripProps {
  nodes: WorkflowNode[];
  maxVisible?: number;
  className?: string;
}

export function NodePreviewStrip({ nodes, maxVisible = 8, className }: NodePreviewStripProps) {
  const { i18n } = useTranslation();
  const isFr = i18n.language.startsWith('fr');
  const visible = nodes.slice(0, maxVisible);
  const overflow = nodes.length - maxVisible;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {visible.map((node, i) => {
        const meta = getNodeTypeMeta(node.type.toUpperCase());
        const Icon = meta.icon;
        const displayLabel =
          (node.data?.label as string | undefined) ?? (isFr ? meta.labelFr : meta.label);
        return (
          <div
            key={node.id ?? i}
            title={isFr ? meta.descriptionFr : meta.description}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium leading-none',
              meta.bgColor,
              meta.borderColor,
            )}
          >
            <Icon className={cn('h-3 w-3 shrink-0', meta.color)} />
            <span className={cn('truncate max-w-[80px]', meta.color)}>{displayLabel}</span>
          </div>
        );
      })}
      {overflow > 0 && (
        <div className="flex items-center px-2 py-1 rounded-lg border border-border/40 text-[11px] text-muted-foreground leading-none">
          +{overflow}
        </div>
      )}
    </div>
  );
}
