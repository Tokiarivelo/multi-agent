'use client';

/**
 * SubWorkflowExecutionPanel
 * ─────────────────────────
 * Shows all child (sub-workflow) executions discovered during the current
 * parent-workflow run, with:
 *  - Status badge per sub-execution
 *  - Timeline of the parent node that launched it
 *  - A link to open the child execution logs in a new tab (deep-link)
 *  - An inline "live logs" view that fetches executed child node statuses
 *    from the last completed execution output stored in nodeData
 */

import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExternalLink, Workflow, ChevronDown, ChevronRight, Clock, CheckCircle2, XCircle, Loader2, CircleDot } from 'lucide-react';
import { useWorkflowExecutionStore, SubExecutionRecord } from '../store/workflowExecution.store';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'destructive' | 'warning' | 'secondary'> = {
  PENDING:   'secondary',
  RUNNING:   'warning',
  COMPLETED: 'success',
  FAILED:    'destructive',
  CANCELLED: 'secondary',
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'COMPLETED') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (status === 'FAILED')    return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  if (status === 'RUNNING')   return <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />;
  return <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />;
}

interface SubExecutionCardProps {
  rec: SubExecutionRecord;
  nodeData: Record<string, unknown>;
}

function SubExecutionCard({ rec, nodeData }: SubExecutionCardProps) {
  const [open, setOpen] = useState(false);
  const { i18n } = useTranslation();
  const isFr = i18n.language.startsWith('fr');

  // Try to read child node executions from the parent SUBWORKFLOW node's output
  const raw = nodeData[rec.parentNodeId] as Record<string, unknown> | undefined;
  const childOutput = raw?.output as Record<string, unknown> | undefined;

  // The child execution variables are flat in the output; show them as a JSON preview
  const outputPreview = childOutput
    ? Object.entries(childOutput).filter(([k]) => !k.startsWith('_')).slice(0, 5)
    : [];

  const hasOutput = outputPreview.length > 0;

  const deepLinkUrl = `/workflows/${rec.subWorkflowId}?executionId=${rec.subExecutionId}`;

  return (
    <div className={cn(
      'rounded-lg border overflow-hidden transition-colors',
      rec.status === 'COMPLETED' ? 'border-emerald-500/20 bg-emerald-500/5' :
      rec.status === 'FAILED'    ? 'border-destructive/20 bg-destructive/5' :
      rec.status === 'RUNNING'   ? 'border-amber-500/20 bg-amber-500/5' :
                                   'border-border/40 bg-muted/10',
    )}>
      {/* Header row */}
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <Workflow className="h-3.5 w-3.5 shrink-0 text-blue-500" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{rec.subWorkflowName}</p>
          <p className="text-[10px] text-muted-foreground font-mono truncate">{rec.subExecutionId}</p>
        </div>
        <Badge variant={STATUS_VARIANT[rec.status] ?? 'default'} className="text-[10px] shrink-0">
          {rec.status}
        </Badge>
        <StatusIcon status={rec.status} />
        {open ? <ChevronDown className="h-3 w-3 opacity-50" /> : <ChevronRight className="h-3 w-3 opacity-50" />}
      </button>

      {/* Expanded view */}
      {open && (
        <div className="border-t border-current/10 px-3 py-2.5 space-y-2.5 text-[11px]">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-1 text-muted-foreground">
            <span className="font-medium text-foreground/80">
              {isFr ? 'Noeud parent' : 'Parent node'}
            </span>
            <code className="font-mono truncate">
              {rec.parentNodeName ?? rec.parentNodeId}
            </code>

            <span className="font-medium text-foreground/80">
              {isFr ? 'Lancé à' : 'Launched at'}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(rec.discoveredAt).toLocaleTimeString()}
            </span>

            <span className="font-medium text-foreground/80">Workflow ID</span>
            <code className="font-mono truncate text-[10px]">{rec.subWorkflowId}</code>
          </div>

          {/* Output variables preview */}
          {hasOutput && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">
                {isFr ? 'Variables de sortie' : 'Output variables'}
              </p>
              <div className="rounded bg-black/5 dark:bg-white/5 px-2 py-1.5 space-y-0.5 font-mono text-[10px]">
                {outputPreview.map(([k, v]) => (
                  <div key={k} className="flex gap-1.5 items-start overflow-hidden">
                    <span className="text-blue-500 shrink-0">{k}:</span>
                    <span className="text-foreground/70 truncate">
                      {typeof v === 'string' ? `"${v}"` : JSON.stringify(v)}
                    </span>
                  </div>
                ))}
                {(childOutput && Object.keys(childOutput).filter(k => !k.startsWith('_')).length > 5) && (
                  <span className="text-muted-foreground">…and more</span>
                )}
              </div>
            </div>
          )}

          {/* Deep link */}
          <a
            href={deepLinkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full h-7 text-[11px] rounded-md border border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            {isFr ? "Ouvrir l'execution enfant" : 'Open child execution'}
          </a>
        </div>
      )}
    </div>
  );
}

export function SubWorkflowExecutionPanel() {
  const { i18n } = useTranslation();
  const isFr = i18n.language.startsWith('fr');

  const subExecutions = useWorkflowExecutionStore((s) => s.subExecutions);
  const nodeData = useWorkflowExecutionStore((s) => s.nodeData);
  const executionStatus = useWorkflowExecutionStore((s) => s.executionStatus);

  const hasRunning = subExecutions.some((s) => s.status === 'RUNNING');

  if (subExecutions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[120px] gap-2 text-muted-foreground p-6">
        <Workflow className="h-8 w-8 opacity-20" />
        <p className="text-sm italic text-center">
          {executionStatus === 'RUNNING'
            ? (isFr ? 'En attente de sous-workflows…' : 'Waiting for sub-workflows…')
            : (isFr
                ? 'Aucun sous-workflow détecté. Lancez une exécution contenant un noeud Sub-Workflow.'
                : 'No sub-workflows detected. Run a workflow containing a Sub-Workflow node.')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Workflow className="h-3.5 w-3.5 text-blue-500" />
          {isFr ? `${subExecutions.length} sous-workflow(s) exécuté(s)` : `${subExecutions.length} sub-workflow(s) executed`}
          {hasRunning && (
            <span className="flex items-center gap-1 text-amber-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              {isFr ? 'en cours' : 'running'}
            </span>
          )}
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {subExecutions.map((rec) => (
            <SubExecutionCard key={rec.subExecutionId} rec={rec} nodeData={nodeData} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
