'use client';

import { Badge } from '@/components/ui/badge';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bot,
  ExternalLink,
  MessageSquare,
  Terminal,
  Wrench,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CollapsibleSection } from './CollapsibleSection';

export interface SingleTurnViewProps {
  selectedNodeId: string;
  selectedNodeName: string | null;
  nodeStatus: string;
  raw: Record<string, unknown> | undefined;
}

export function SingleTurnView({
  selectedNodeId,
  selectedNodeName,
  nodeStatus,
  raw,
}: SingleTurnViewProps) {
  const input = raw?.input as Record<string, unknown> | string | undefined;
  const output = raw?.output as Record<string, unknown> | string | undefined;
  const consoleLogs = raw?.logs as string[] | undefined;

  const agentText =
    typeof output === 'object' && output !== null
      ? (((output as Record<string, unknown>).output as string | undefined) ??
        ((output as Record<string, unknown>).text as string | undefined))
      : typeof output === 'string'
        ? output
        : undefined;

  const toolCalls =
    typeof output === 'object' && output !== null
      ? ((output as Record<string, unknown>).toolCalls as
          | Array<{ name: string; arguments?: unknown; result?: unknown }>
          | undefined)
      : undefined;

  const subAgentResults =
    typeof output === 'object' && output !== null
      ? ((output as Record<string, unknown>).subAgentResults as
          | Array<{ agentId: string; output?: unknown; error?: string }>
          | undefined)
      : undefined;

  const tokens =
    typeof output === 'object' && output !== null
      ? ((output as Record<string, unknown>).tokens as number | undefined)
      : undefined;

  const outputObj = output as Record<string, unknown> | undefined;
  const subExecId = outputObj?._subExecutionId as string | undefined;
  const subWfName = outputObj?._subWorkflowName as string | undefined;
  const subWfId = outputObj?._subWorkflowId as string | undefined;

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">
          Node:{' '}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded mr-1">
            {selectedNodeName || 'Unknown'}
          </code>
          <span className="text-muted-foreground text-xs font-normal">[{selectedNodeId}]</span>
        </span>
        <div className="flex items-center gap-2">
          {tokens !== undefined && (
            <span className="text-[10px] text-muted-foreground font-mono">{tokens} tokens</span>
          )}
          <Badge
            variant={
              nodeStatus === 'COMPLETED' ? 'success' : nodeStatus === 'FAILED' ? 'destructive' : 'secondary'
            }
          >
            {nodeStatus}
          </Badge>
        </div>
      </div>

      <CollapsibleSection title="Input" icon={<ArrowDownToLine className="h-3.5 w-3.5" />} accent="sky" defaultOpen={false}>
        <pre className="text-[11px] font-mono overflow-auto max-h-40 text-foreground/80 mt-1 whitespace-pre-wrap break-all">
          {input !== undefined ? JSON.stringify(input, null, 2) : 'No input recorded.'}
        </pre>
      </CollapsibleSection>

      {agentText && (
        <CollapsibleSection title="Agent Response" icon={<MessageSquare className="h-3.5 w-3.5" />} accent="emerald">
          <p className="text-xs leading-relaxed text-foreground/80 mt-1 whitespace-pre-wrap">{agentText}</p>
        </CollapsibleSection>
      )}

      {toolCalls && toolCalls.length > 0 && (
        <CollapsibleSection title="Tool Calls" icon={<Wrench className="h-3.5 w-3.5" />} accent="amber" count={toolCalls.length}>
          <div className="space-y-2 mt-1">
            {toolCalls.map((tc, i) => (
              <div key={i} className="rounded-md border border-amber-500/20 bg-background/60 p-2 space-y-1">
                <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Wrench className="h-3 w-3" /> {tc.name}
                </p>
                {tc.arguments !== undefined && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Arguments</p>
                    <pre className="text-[10px] font-mono bg-muted/40 rounded px-2 py-1 overflow-auto max-h-24 whitespace-pre-wrap break-all">
                      {typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments, null, 2)}
                    </pre>
                  </div>
                )}
                {tc.result !== undefined && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Result</p>
                    <pre className="text-[10px] font-mono bg-emerald-500/5 border border-emerald-500/20 rounded px-2 py-1 overflow-auto max-h-24 whitespace-pre-wrap break-all text-emerald-700 dark:text-emerald-400">
                      {typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {subAgentResults && subAgentResults.length > 0 && (
        <CollapsibleSection title="Sub-Agent Results" icon={<Bot className="h-3.5 w-3.5" />} accent="violet" count={subAgentResults.length}>
          <div className="space-y-2 mt-1">
            {subAgentResults.map((sa, i) => (
              <div key={i} className="rounded-md border border-violet-500/20 bg-background/60 p-2 space-y-1">
                <p className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                  <Bot className="h-3 w-3" /> {sa.agentId}
                </p>
                {sa.error ? (
                  <p className="text-[10px] text-destructive">{sa.error}</p>
                ) : (
                  <pre className="text-[10px] font-mono bg-muted/40 rounded px-2 py-1 overflow-auto max-h-24 whitespace-pre-wrap break-all">
                    {typeof sa.output === 'string' ? sa.output : JSON.stringify(sa.output, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {consoleLogs && consoleLogs.length > 0 && (
        <CollapsibleSection title="Console Logs" icon={<Terminal className="h-3.5 w-3.5" />} accent="neutral" count={consoleLogs.length} defaultOpen={false}>
          <div className="mt-1 space-y-0.5 font-mono text-[10px]">
            {consoleLogs.map((line, i) => {
              const isError = line.startsWith('[ERROR]');
              const isWarn = line.startsWith('[WARN]');
              return (
                <p
                  key={i}
                  className={cn(
                    'leading-relaxed',
                    isError ? 'text-red-500' : isWarn ? 'text-yellow-500' : 'text-muted-foreground',
                  )}
                >
                  {line}
                </p>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {subExecId && (
        <CollapsibleSection
          title={`Sub-Workflow: ${subWfName ?? subWfId}`}
          icon={<WorkflowIcon className="h-3.5 w-3.5 text-blue-500" />}
          accent="sky"
        >
          <div className="mt-1 space-y-2">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
              <span className="text-muted-foreground">Child Execution ID</span>
              <code className="font-mono text-[10px] text-foreground/80 truncate">{subExecId}</code>
              <span className="text-muted-foreground">Workflow ID</span>
              <code className="font-mono text-[10px] text-foreground/80 truncate">{subWfId}</code>
            </div>
            <a
              href={`/workflows?executionId=${subExecId}&workflowId=${subWfId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-blue-500 hover:text-blue-400 underline underline-offset-2 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Open child execution
            </a>
          </div>
        </CollapsibleSection>
      )}

      {!agentText && !toolCalls && !subAgentResults && (
        <CollapsibleSection title="Raw Output" icon={<ArrowUpFromLine className="h-3.5 w-3.5" />} accent="neutral" defaultOpen>
          <pre className="text-[11px] font-mono overflow-auto max-h-48 text-foreground/80 mt-1 whitespace-pre-wrap break-all">
            {output !== undefined ? JSON.stringify(output, null, 2) : 'No output recorded.'}
          </pre>
        </CollapsibleSection>
      )}
    </div>
  );
}
