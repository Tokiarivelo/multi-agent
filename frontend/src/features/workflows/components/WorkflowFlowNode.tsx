'use client';

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { WorkflowNodeData } from './WorkflowCanvas';

export const WorkflowFlowNode = memo(
  ({ data, selected }: NodeProps & { data: WorkflowNodeData; selected?: boolean }) => {
    const { i18n } = useTranslation();
    const { meta, label, labelFr, config, nodeType } = data;
    const Icon = meta?.icon;

    const isStart = nodeType === 'START';
    const isEnd = nodeType === 'END';
    const isCondition = nodeType === 'CONDITIONAL';

    // Config summary line
    let configSummary = '';
    if (typeof config?.agentId === 'string' && config.agentId)
      configSummary = `Agent: ${config.agentId.slice(0, 16)}`;
    else if (typeof config?.toolId === 'string' && config.toolId)
      configSummary = `Tool: ${config.toolId.slice(0, 16)}`;
    else if (typeof config?.condition === 'string' && config.condition)
      configSummary = config.condition.slice(0, 24);

    // Color maps for dynamic styling
    const colorKey = meta?.color?.split('-')[1] ?? 'violet';

    // Aesthetic themes
    const themes: Record<string, string> = {
      emerald: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
      rose: 'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400',
      violet: 'bg-violet-500/15 border-violet-500/40 text-violet-600 dark:text-violet-400',
      amber: 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400',
      sky: 'bg-sky-500/15 border-sky-500/40 text-sky-600 dark:text-sky-400',
      orange: 'bg-orange-500/15 border-orange-500/40 text-orange-600 dark:text-orange-400',
    };
    const nodeTheme = themes[colorKey] ?? 'bg-card border-border/50 text-foreground';

    // Different shapes based on type
    let shapeClass = 'rounded-2xl px-4 py-3 min-w-[150px] max-w-[220px]'; // default (Agent, Tool, Transform)
    if (isStart || isEnd) {
      shapeClass = 'rounded-full px-5 py-2.5 flex justify-center min-w-[120px]';
    } else if (isCondition) {
      shapeClass = 'rounded-lg px-4 py-3 border-dashed border-[2.5px] min-w-[150px]';
    }

    return (
      <div
        className={cn(
          'relative border shadow-sm transition-all backdrop-blur-xl group',
          shapeClass,
          nodeTheme,
          selected &&
            'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg scale-105 z-10',
        )}
      >
        {/* Input handle (top) — not for START */}
        {!isStart && (
          <Handle
            type="target"
            position={Position.Top}
            className="bg-primary/80! border-background! w-3! h-3! transition-transform group-hover:scale-125"
          />
        )}

        <div
          className={cn(
            'flex items-center gap-2',
            isStart || isEnd ? 'justify-center' : 'justify-start',
          )}
        >
          {Icon && (
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/60 border border-border/10 shadow-sm',
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[12px] font-bold leading-tight truncate text-foreground">
              {i18n.language.startsWith('fr') ? labelFr : label}
            </p>
          </div>
        </div>

        {configSummary && (
          <p className="mt-2 text-[10px] leading-tight text-foreground/70 font-medium truncate border-t border-foreground/10 pt-1.5 mix-blend-luminosity">
            {configSummary}
          </p>
        )}

        {/* Output handle (bottom) — not for END */}
        {!isEnd && (
          <Handle
            type="source"
            position={Position.Bottom}
            className="bg-primary/80! border-background! w-3! h-3! transition-transform group-hover:scale-125"
          />
        )}
      </div>
    );
  },
);

WorkflowFlowNode.displayName = 'WorkflowFlowNode';
