'use client';

import { memo, useEffect } from 'react';
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
  Wrench,
  Bot,
  CheckCircle,
  XCircle,
  History,
  RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { workflowsApi } from '../api/workflows.api';
import { Trash2, Settings2, Copy } from 'lucide-react';
import { useTokenUsage } from '@/features/analytics/hooks/useTokenUsage';
import { AgentTokenHistoryModal } from '@/features/analytics/components/AgentTokenHistoryModal';
import { useQueryClient } from '@tanstack/react-query';

function formatRelativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export const WorkflowFlowNode = memo(
  ({ data, selected, id }: NodeProps & { data: WorkflowNodeData; selected?: boolean }) => {
    const { i18n } = useTranslation();
    const { meta, label, labelFr, config, nodeType, resolvedToolNames, resolvedSubAgents } = data;
    const Icon = meta?.icon;

    const nodeStatus = useWorkflowExecutionStore((s) => s.nodeStatuses[id]);
    const activeExecutionId = useWorkflowExecutionStore((s) => s.activeExecutionId);
    const liveTokens = useWorkflowExecutionStore((s) => s.nodeTokenProgress[id]);
    const nodeData = useWorkflowExecutionStore((s) => s.nodeData[id]) as
      | Record<string, unknown>
      | undefined;
    const proposals = Array.isArray(nodeData?.proposals)
      ? (nodeData.proposals as Array<string | Record<string, unknown>>)
      : [];
    const multiSelect = nodeData?.multiSelect !== false;

    const [promptInput, setPromptInput] = useState('');
    const [selectedProposals, setSelectedProposals] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    const queryClient = useQueryClient();
    const agentIdForTokens =
      nodeType === 'AGENT' ? (data.config?.agentId as string | undefined) : undefined;

    // Refetch token usage immediately when the node finishes (bypasses 30s staleTime)
    useEffect(() => {
      if ((nodeStatus === 'COMPLETED' || nodeStatus === 'FAILED') && agentIdForTokens) {
        queryClient.invalidateQueries({ queryKey: ['token-usage'] });
      }
    }, [nodeStatus, agentIdForTokens, queryClient]);

    const { data: tokenData } = useTokenUsage({
      agentId: agentIdForTokens,
      limit: 1,
      page: 1,
      enabled: !!agentIdForTokens,
    });
    const lastExecution = agentIdForTokens ? (tokenData?.data?.[0] ?? null) : null;

    const handleResume = async () => {
      let finalInput = promptInput;
      if (selectedProposals.length > 0) {
        finalInput = multiSelect ? JSON.stringify(selectedProposals) : selectedProposals[0];
      } else if (!promptInput.trim()) {
        return;
      }
      if (!activeExecutionId) return;

      setIsSubmitting(true);
      try {
        await workflowsApi.resumeNode(activeExecutionId, id, finalInput);
        setPromptInput('');
        setSelectedProposals([]);
      } catch (err) {
        console.error('Failed to submit prompt input', err);
      } finally {
        setIsSubmitting(false);
      }
    };

    const isStart = nodeType === 'START';
    const isEnd = nodeType === 'END';
    const isCondition = nodeType === 'CONDITIONAL';
    const isAgent = nodeType === 'AGENT';
    const isOrchestrator = nodeType === 'ORCHESTRATOR';

    // Config summary line (for non-agent nodes)
    let configSummary = '';
    if (!isAgent && !isOrchestrator && typeof config?.agentId === 'string' && config.agentId)
      configSummary = `Agent: ${config.agentId.slice(0, 16)}`;
    else if (typeof config?.toolId === 'string' && config.toolId)
      configSummary = `Tool: ${config.toolId.slice(0, 16)}`;
    else if (typeof config?.condition === 'string' && config.condition)
      configSummary = config.condition.slice(0, 24);

    const safeToolNames = (resolvedToolNames as string[] | undefined) ?? [];
    const safeSubAgents =
      (resolvedSubAgents as { name: string; role?: string }[] | undefined) ?? [];

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

    const isDeletable = !isStart && !isEnd;

    const dispatchNodeAction = (type: 'delete' | 'edit' | 'duplicate') => {
      window.dispatchEvent(
        new CustomEvent(`workflow-node-action`, { detail: { nodeId: id, action: type } }),
      );
    };

    return (
      // Outer wrapper extends hover zone upward to cover the action bar (pt-8)
      <div className={cn('relative group', isDeletable && !isExecuting && 'pt-8 -mt-8')}>
        {showHistory && agentIdForTokens && (
          <AgentTokenHistoryModal
            agentId={agentIdForTokens}
            agentName={typeof data.label === 'string' ? data.label : undefined}
            open={showHistory}
            onClose={() => setShowHistory(false)}
          />
        )}
        {/* Node action bar — pinned at the top of the outer wrapper */}
        {isDeletable && !isExecuting && (
          <div className="absolute top-0 left-0 right-0 flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30 px-0.5">
            <button
              className="flex items-center justify-center h-6 w-6 rounded-md bg-background/95 border border-border/60 text-muted-foreground hover:text-foreground hover:border-border shadow-md backdrop-blur-sm transition-all hover:scale-105 active:scale-95"
              title="Edit node"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                dispatchNodeAction('edit');
              }}
            >
              <Settings2 className="h-3 w-3" />
            </button>
            <button
              className="flex items-center justify-center h-6 w-6 rounded-md bg-background/95 border border-border/60 text-muted-foreground hover:text-foreground hover:border-border shadow-md backdrop-blur-sm transition-all hover:scale-105 active:scale-95"
              title="Duplicate node (Ctrl+D)"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                dispatchNodeAction('duplicate');
              }}
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              className="flex items-center justify-center h-6 w-6 rounded-md bg-background/95 border border-destructive/30 text-destructive/60 hover:text-destructive hover:border-destructive shadow-md backdrop-blur-sm transition-all hover:scale-105 active:scale-95"
              title="Delete node"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                dispatchNodeAction('delete');
              }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* ── Actual node card ── */}
        <div
          className={cn(
            'relative border shadow-sm transition-all backdrop-blur-xl',
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

          {/* AGENT node: tool & sub-agent badges */}
          {isAgent && (safeToolNames.length > 0 || safeSubAgents.length > 0) && (
            <div className="mt-2 border-t border-foreground/10 pt-1.5 space-y-1">
              {safeToolNames.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {safeToolNames.slice(0, 3).map((name, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-600 dark:text-amber-400 font-medium leading-none"
                    >
                      <Wrench className="h-2 w-2 shrink-0" />
                      {name.length > 10 ? `${name.slice(0, 10)}…` : name}
                    </span>
                  ))}
                  {safeToolNames.length > 3 && (
                    <span className="text-[9px] text-muted-foreground/60 leading-none py-0.5">
                      +{safeToolNames.length - 3}
                    </span>
                  )}
                </div>
              )}
              {safeSubAgents.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {safeSubAgents.slice(0, 2).map((sa, i) => (
                    <span
                      key={i}
                      title={sa.role ?? ''}
                      className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-600 dark:text-violet-400 font-medium leading-none"
                    >
                      <Bot className="h-2 w-2 shrink-0" />
                      {sa.name.length > 10 ? `${sa.name.slice(0, 10)}…` : sa.name}
                    </span>
                  ))}
                  {safeSubAgents.length > 2 && (
                    <span className="text-[9px] text-muted-foreground/60 leading-none py-0.5">
                      +{safeSubAgents.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* AGENT node: live token counter during execution */}
          {isAgent && nodeStatus === 'RUNNING' && liveTokens && (
            <div className="mt-2 border-t border-foreground/10 pt-1.5 space-y-0.5">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  <Loader2 className="h-2.5 w-2.5 text-primary animate-spin shrink-0" />
                  <span className="text-[9px] font-mono font-semibold text-primary animate-pulse shrink-0">
                    {liveTokens.totalTokens.toLocaleString()} tok
                  </span>
                  <span className="text-[9px] text-muted-foreground/60 shrink-0">
                    ↑{liveTokens.inputTokens.toLocaleString()} ↓
                    {liveTokens.outputTokens.toLocaleString()}
                  </span>
                </div>
                {liveTokens.iteration > 0 && (
                  <span className="text-[9px] text-muted-foreground/50 shrink-0">
                    iter {liveTokens.iteration}
                  </span>
                )}
              </div>
              <div className="w-full h-0.5 rounded-full bg-foreground/10 overflow-hidden">
                <div
                  className="h-full bg-primary/60 rounded-full animate-pulse"
                  style={{ width: `${Math.min(100, (liveTokens.iteration / 5) * 100 + 20)}%` }}
                />
              </div>
            </div>
          )}

          {/* AGENT node: last execution token summary */}
          {isAgent && lastExecution && !(nodeStatus === 'RUNNING' && liveTokens) && (
            <div className="mt-2 border-t border-foreground/10 pt-1.5 space-y-0.5">
              {/* row 1: status + tokens */}
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  {lastExecution.success ? (
                    <CheckCircle className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-2.5 w-2.5 text-destructive shrink-0" />
                  )}
                  <span className="text-[9px] font-mono font-semibold text-violet-600 shrink-0">
                    {lastExecution.totalTokens.toLocaleString()} tok
                  </span>
                  <span className="text-[9px] text-muted-foreground/60 shrink-0">
                    ↑{lastExecution.inputTokens.toLocaleString()} ↓
                    {lastExecution.outputTokens.toLocaleString()}
                  </span>
                </div>
                <button
                  title="View token history"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowHistory(true);
                  }}
                  className="flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-violet-500 transition-colors shrink-0"
                >
                  <History className="h-2.5 w-2.5" />
                  History
                </button>
              </div>
              {/* row 2: model + timestamp */}
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] text-muted-foreground/50 truncate">
                  {lastExecution.model.split('-').slice(0, 2).join('-')}
                </span>
                <span className="text-[9px] text-muted-foreground/50 shrink-0">
                  {formatRelativeTime(lastExecution.timestamp)}
                </span>
              </div>
            </div>
          )}

          {/* ORCHESTRATOR node: loop + sub-agent badges */}
          {isOrchestrator && (
            <div className="mt-2 border-t border-foreground/10 pt-1.5 space-y-1">
              <div className="flex flex-wrap gap-1">
                <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-600 dark:text-indigo-400 font-medium leading-none">
                  <RefreshCw className="h-2 w-2 shrink-0" />
                  {`×${(config?.maxIterations as number) ?? 10}`}
                </span>
                {((config?.subAgents as { agentId: string }[]) ?? []).slice(0, 2).map((sa, i) => {
                  const name = safeSubAgents[i]?.name ?? sa.agentId.slice(0, 10);
                  return (
                    <span
                      key={i}
                      className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-600 dark:text-violet-400 font-medium leading-none"
                    >
                      <Bot className="h-2 w-2 shrink-0" />
                      {name.length > 10 ? `${name.slice(0, 10)}…` : name}
                    </span>
                  );
                })}
                {((config?.subAgents as unknown[]) ?? []).length > 2 && (
                  <span className="text-[9px] text-muted-foreground/60 leading-none py-0.5">
                    +{((config?.subAgents as unknown[]) ?? []).length - 2}
                  </span>
                )}
              </div>
              {nodeStatus === 'RUNNING' &&
                (nodeData as Record<string, unknown>)?._iteration !== undefined && (
                  <p className="text-[9px] text-indigo-400 font-mono">
                    iter {String((nodeData as Record<string, unknown>)._iteration ?? 0)}
                  </p>
                )}
            </div>
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
            <div className="absolute top-[110%] left-1/2 -translate-x-1/2 w-[300px] bg-background border border-border/50 shadow-xl rounded-xl p-3 z-50 animate-in fade-in slide-in-from-top-4">
              <p className="text-xs font-semibold mb-2 text-blue-500 flex items-center gap-1.5">
                <MessageCircleQuestion className="w-4 h-4" /> Wait: Input Required
              </p>

              {proposals.length > 0 && (
                <div className="mb-3 space-y-2 max-h-[150px] overflow-y-auto pr-1">
                  <p className="text-[10px] text-muted-foreground font-medium">
                    {multiSelect ? 'Select one or more options:' : 'Select an option:'}
                  </p>
                  {proposals.map((proposal: string | Record<string, unknown>, i: number) => {
                    const value =
                      typeof proposal === 'object' && proposal !== null
                        ? String(proposal.value || proposal.id || JSON.stringify(proposal))
                        : String(proposal);
                    const label =
                      typeof proposal === 'object' && proposal !== null
                        ? String(proposal.label || proposal.description || JSON.stringify(proposal))
                        : String(proposal);
                    const isSelected = selectedProposals.includes(value);
                    return (
                      <label
                        key={i}
                        className={cn(
                          'flex items-start gap-2 p-2 rounded-md border text-xs cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-muted/30 border-border/50 hover:bg-muted/50',
                        )}
                      >
                        <input
                          type={multiSelect ? 'checkbox' : 'radio'}
                          name={multiSelect ? undefined : `proposal-${id}`}
                          checked={isSelected}
                          onChange={() => {
                            if (multiSelect) {
                              if (isSelected)
                                setSelectedProposals((prev) => prev.filter((p) => p !== value));
                              else setSelectedProposals((prev) => [...prev, value]);
                            } else {
                              setSelectedProposals([value]);
                            }
                          }}
                          className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary w-3.5 h-3.5"
                        />
                        <span className="leading-tight">{label}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  placeholder={
                    proposals.length ? 'Or type your own response...' : 'Type your response...'
                  }
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
                  disabled={isSubmitting || (!promptInput.trim() && selectedProposals.length === 0)}
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
      </div>
    );
  },
);

WorkflowFlowNode.displayName = 'WorkflowFlowNode';
