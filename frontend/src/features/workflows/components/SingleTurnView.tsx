'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bot,
  ExternalLink,
  Maximize2,
  MessageSquare,
  Terminal,
  Wrench,
  Workflow as WorkflowIcon,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { CollapsibleSection } from './CollapsibleSection';
import { FullscreenDataModal } from './FullscreenDataModal';
import { StructuredDataViewer } from './StructuredDataViewer';
import { TestOutcomePanel } from './TestOutcomePanel';
import { useWorkflow } from '../hooks/useWorkflows';
import { useTools } from '@/features/tools/hooks/useTools';
import { useSearchParams } from 'next/navigation';

export interface SingleTurnViewProps {
  selectedNodeId: string;
  selectedNodeName: string | null;
  nodeStatus: string;
  raw: Record<string, unknown> | undefined;
  onApplyFix?: (fixedConfig: Record<string, unknown>) => void;
  onEditAi?: () => void;
}

function FullscreenButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-5 w-5 opacity-60 hover:opacity-100 transition-opacity"
      onClick={onClick}
      title={title}
    >
      <Maximize2 className="h-3 w-3" />
    </Button>
  );
}

export function SingleTurnView({
  selectedNodeId,
  selectedNodeName,
  nodeStatus,
  raw,
  onApplyFix,
  onEditAi,
}: SingleTurnViewProps) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const workflowId = searchParams.get('workflowId');
  const { data: workflow } = useWorkflow(workflowId);
  const { data: toolsData } = useTools(1, 100);
  const availableTools = toolsData?.data ?? [];

  const [fullscreen, setFullscreen] = useState<{ title: string; data: unknown } | null>(null);

  const selectedNode = useMemo(
    () => workflow?.definition.nodes.find((n: { id: string }) => n.id === selectedNodeId),
    [workflow?.definition.nodes, selectedNodeId],
  );
  const selectedNodeType = (selectedNode as { type?: string } | undefined)?.type ?? 'AGENT';
  const selectedNodeConfig =
    (selectedNode as { config?: Record<string, unknown> } | undefined)?.config ?? {};
  const selectedNodeToolIds = (selectedNodeConfig.toolIds as string[] | undefined) ?? [];

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
          | Array<{ name: string; args?: unknown; arguments?: unknown; result?: unknown }>
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

  const openFullscreen = (title: string, data: unknown) => setFullscreen({ title, data });

  return (
    <div className="flex flex-col gap-3 p-4">
      {fullscreen && (
        <FullscreenDataModal
          open
          onClose={() => setFullscreen(null)}
          title={fullscreen.title}
          data={fullscreen.data}
        />
      )}

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
              nodeStatus === 'COMPLETED'
                ? 'success'
                : nodeStatus === 'FAILED'
                  ? 'destructive'
                  : 'secondary'
            }
          >
            {nodeStatus}
          </Badge>
          {onEditAi && (
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-full text-violet-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30 border-violet-200 dark:border-violet-800"
              onClick={onEditAi}
              title={t('workflows.nodeAi.title')}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <CollapsibleSection
        title="Input"
        icon={<ArrowDownToLine className="h-3.5 w-3.5" />}
        accent="sky"
        defaultOpen={false}
        actions={
          input !== undefined ? (
            <FullscreenButton
              title={t('workflows.fullscreen.viewFullscreen')}
              onClick={() => openFullscreen('Input', input)}
            />
          ) : undefined
        }
      >
        <div className="mt-1">
          {input !== undefined ? (
            <StructuredDataViewer data={input} />
          ) : (
            <span className="text-[11px] text-muted-foreground italic">No input recorded.</span>
          )}
        </div>
      </CollapsibleSection>

      {agentText && (
        <CollapsibleSection
          title="Agent Response"
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          accent="emerald"
          actions={
            <FullscreenButton
              title={t('workflows.fullscreen.viewFullscreen')}
              onClick={() => openFullscreen('Agent Response', agentText)}
            />
          }
        >
          <div className="mt-1">
            <StructuredDataViewer data={agentText} />
          </div>
        </CollapsibleSection>
      )}

      {toolCalls && toolCalls.length > 0 && (
        <CollapsibleSection
          title="Tool Calls"
          icon={<Wrench className="h-3.5 w-3.5" />}
          accent="amber"
          count={toolCalls.length}
        >
          <div className="space-y-3 mt-1">
            {toolCalls.map((tc, i) => {
              const args = tc.args ?? tc.arguments;
              return (
                <div
                  key={i}
                  className="rounded-md border border-amber-500/20 bg-background/60 p-2 space-y-2"
                >
                  <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Wrench className="h-3 w-3" /> {tc.name}
                  </p>
                  {args !== undefined && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                          Arguments
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 opacity-60 hover:opacity-100"
                          title={t('workflows.fullscreen.viewFullscreen')}
                          onClick={() => openFullscreen(`${tc.name} — Arguments`, args)}
                        >
                          <Maximize2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <StructuredDataViewer data={args} />
                    </div>
                  )}
                  {tc.result !== undefined && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                          Result
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 opacity-60 hover:opacity-100"
                          title={t('workflows.fullscreen.viewFullscreen')}
                          onClick={() => openFullscreen(`${tc.name} — Result`, tc.result)}
                        >
                          <Maximize2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <StructuredDataViewer data={tc.result} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {subAgentResults && subAgentResults.length > 0 && (
        <CollapsibleSection
          title="Sub-Agent Results"
          icon={<Bot className="h-3.5 w-3.5" />}
          accent="violet"
          count={subAgentResults.length}
        >
          <div className="space-y-2 mt-1">
            {subAgentResults.map((sa, i) => (
              <div
                key={i}
                className="rounded-md border border-violet-500/20 bg-background/60 p-2 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                    <Bot className="h-3 w-3" /> {sa.agentId}
                  </p>
                  {!sa.error && sa.output !== undefined && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 opacity-60 hover:opacity-100"
                      title={t('workflows.fullscreen.viewFullscreen')}
                      onClick={() => openFullscreen(`Sub-Agent: ${sa.agentId}`, sa.output)}
                    >
                      <Maximize2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {sa.error ? (
                  <p className="text-[10px] text-destructive">{sa.error}</p>
                ) : (
                  <StructuredDataViewer data={sa.output} />
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {consoleLogs && consoleLogs.length > 0 && (
        <CollapsibleSection
          title="Console Logs"
          icon={<Terminal className="h-3.5 w-3.5" />}
          accent="neutral"
          count={consoleLogs.length}
          defaultOpen={false}
          actions={
            <FullscreenButton
              title={t('workflows.fullscreen.viewFullscreen')}
              onClick={() => openFullscreen('Console Logs', consoleLogs)}
            />
          }
        >
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
        <CollapsibleSection
          title="Raw Output"
          icon={<ArrowUpFromLine className="h-3.5 w-3.5" />}
          accent="neutral"
          defaultOpen
          actions={
            output !== undefined ? (
              <FullscreenButton
                title={t('workflows.fullscreen.viewFullscreen')}
                onClick={() => openFullscreen('Raw Output', output)}
              />
            ) : undefined
          }
        >
          <div className="mt-1">
            {output !== undefined ? (
              <StructuredDataViewer data={output} />
            ) : (
              <span className="text-[11px] text-muted-foreground italic">No output recorded.</span>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* AI Analyzer */}
      {(nodeStatus === 'COMPLETED' || nodeStatus === 'FAILED') && workflowId && workflow && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-violet-500" />
            {t('healing.test.analyzeExecution')}
          </p>
          <TestOutcomePanel
            workflowId={workflowId}
            nodeId={selectedNodeId}
            nodeName={selectedNodeName || undefined}
            nodeType={selectedNodeType}
            testOutput={output}
            testInput={input}
            currentNodeConfig={selectedNodeConfig}
            currentToolIds={selectedNodeToolIds}
            availableTools={availableTools}
            onApplyFix={onApplyFix}
          />
        </div>
      )}
    </div>
  );
}
