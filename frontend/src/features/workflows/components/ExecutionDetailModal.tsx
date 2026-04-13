'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WorkflowExecutionSummary } from '../api/workflows.api';

interface Props {
  execution: WorkflowExecutionSummary | null;
  onClose: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: 'bg-green-500/20 text-green-400 border-green-500/30',
  FAILED: 'bg-red-500/20 text-red-400 border-red-500/30',
  RUNNING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  CANCELLED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function truncate(text: string, max = 500): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

type NodeExecution = {
  nodeId: string;
  status: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  retryCount?: number;
};

export function ExecutionDetailModal({ execution, onClose }: Props) {
  if (!execution) return null;

  const nodeExecutions: NodeExecution[] = Array.isArray(execution.nodeExecutions)
    ? (execution.nodeExecutions as NodeExecution[])
    : [];

  return (
    <Dialog open={!!execution} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Execution Details
            <Badge className={STATUS_STYLES[execution.status] ?? ''}>
              {execution.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-4 pb-2">
            {/* Summary */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Summary</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <span className="text-muted-foreground">Execution ID</span>
                <span className="font-mono text-xs truncate">{execution.executionId}</span>
                <span className="text-muted-foreground">Started</span>
                <span>{formatDate(execution.startedAt)}</span>
                <span className="text-muted-foreground">Completed</span>
                <span>{formatDate(execution.completedAt)}</span>
                <span className="text-muted-foreground">Duration</span>
                <span>{formatDuration(execution.duration)}</span>
                {execution.error && (
                  <>
                    <span className="text-muted-foreground">Error</span>
                    <span className="text-red-400 text-xs">{execution.error}</span>
                  </>
                )}
              </div>
            </section>

            {/* Token breakdown */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Token Usage</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total', value: execution.totalTokens },
                  { label: 'Input', value: execution.inputTokens },
                  { label: 'Output', value: execution.outputTokens },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg font-semibold">{value.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Node executions */}
            {nodeExecutions.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                  Nodes ({nodeExecutions.length})
                </h3>
                <div className="space-y-2">
                  {nodeExecutions.map((node, i) => (
                    <div key={node.nodeId ?? i} className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs text-muted-foreground">{node.nodeId}</span>
                        <Badge className={STATUS_STYLES[node.status] ?? 'bg-gray-500/20 text-gray-400'}>
                          {node.status}
                        </Badge>
                      </div>
                      {node.error && (
                        <p className="text-xs text-red-400 mt-1">{node.error}</p>
                      )}
                      {node.output !== undefined && (
                        <details className="mt-1">
                          <summary className="text-xs text-muted-foreground cursor-pointer">Output</summary>
                          <pre className="mt-1 text-xs bg-muted/40 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                            {truncate(JSON.stringify(node.output, null, 2))}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
