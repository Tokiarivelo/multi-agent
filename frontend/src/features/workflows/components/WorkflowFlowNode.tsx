'use client';

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { WorkflowNodeData } from './WorkflowCanvas';
import { useWorkflowExecutionStore } from '../store/workflowExecution.store';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  MessageCircleQuestion,
  SendHorizontal,
} from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { workflowsApi } from '../api/workflows.api';

export const WorkflowFlowNode = memo(
  ({ data, selected, id }: NodeProps & { data: WorkflowNodeData; selected?: boolean }) => {
    const { i18n } = useTranslation();
    const { meta, label, labelFr, config, nodeType } = data;
    const Icon = meta?.icon;

    const nodeStatus = useWorkflowExecutionStore((s) => s.nodeStatuses[id]);
    const activeExecutionId = useWorkflowExecutionStore((s) => s.activeExecutionId);

    const [promptInput, setPromptInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleResume = async () => {
      if (!promptInput.trim() || !activeExecutionId) return;
      setIsSubmitting(true);
      try {
        await workflowsApi.resumeNode(activeExecutionId, id, promptInput);
        setPromptInput('');
      } catch (err) {
        console.error('Failed to submit prompt input', err);
      } finally {
        setIsSubmitting(false);
      }
    };

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
    let nodeTheme = themes[colorKey] ?? 'bg-card border-border/50 text-foreground';

    // Execution styling overrides
    const isExecuting = activeExecutionId !== null;
    let statusBorder = '';
    let StatusIcon = null;
    let statusIconColor = '';

    if (isExecuting) {
      if (nodeStatus === 'COMPLETED') {
        statusBorder =
          'ring-2 ring-primary/60 ring-offset-2 ring-offset-background shadow-[0_0_20px_rgba(var(--primary),0.25)]';
        StatusIcon = CheckCircle2;
        statusIconColor = 'text-primary';
      } else if (nodeStatus === 'RUNNING') {
        statusBorder = 'ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse';
        StatusIcon = Loader2;
        statusIconColor = 'text-primary animate-spin';
      } else if (nodeStatus === 'FAILED') {
        nodeTheme = 'bg-rose-500/20 border-rose-500/50 text-rose-600 dark:text-rose-400';
        statusBorder = 'ring-2 ring-rose-500 ring-offset-2 ring-offset-background';
        StatusIcon = AlertCircle;
        statusIconColor = 'text-rose-500';
      } else if (nodeStatus === 'WAITING_INPUT') {
        statusBorder = 'ring-2 ring-blue-500 ring-offset-2 ring-offset-background animate-pulse';
        StatusIcon = MessageCircleQuestion;
        statusIconColor = 'text-blue-500 animate-bounce';
      } else {
        // Not executed or pending
        nodeTheme = 'bg-muted/40 border-border/30 text-muted-foreground grayscale opacity-60';
      }
    }

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
          statusBorder,
          selected &&
            !isExecuting &&
            'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg scale-105 z-10',
        )}
      >
        {StatusIcon && (
          <div className="absolute -top-2 -right-2 bg-background rounded-full shrink-0 z-20 shadow-sm border border-border">
            <StatusIcon className={cn('w-5 h-5', statusIconColor)} />
          </div>
        )}
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

        {/* Chat input popover if waiting for input */}
        {nodeStatus === 'WAITING_INPUT' && activeExecutionId && (
          <div className="absolute top-[110%] left-1/2 -translate-x-1/2 w-[280px] bg-background border border-border/50 shadow-xl rounded-xl p-3 z-50 animate-in fade-in slide-in-from-top-4">
            <p className="text-xs font-semibold mb-2 text-blue-500 flex items-center gap-1.5">
              <MessageCircleQuestion className="w-4 h-4" /> Wait: Input Required
            </p>
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                placeholder="Type your response..."
                className="h-8 text-xs bg-muted/50"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleResume();
                }}
                disabled={isSubmitting}
              />
              <Button
                size="icon"
                variant="default"
                className="h-8 w-8 shrink-0 bg-blue-500 hover:bg-blue-600"
                onClick={handleResume}
                disabled={isSubmitting || !promptInput.trim()}
              >
                {isSubmitting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <SendHorizontal className="w-3 h-3" />
                )}
              </Button>
            </div>
            {/* Pointer arrow pointing to node */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-background border-t border-l border-border/50 rotate-45" />
          </div>
        )}
      </div>
    );
  },
);

WorkflowFlowNode.displayName = 'WorkflowFlowNode';
