'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import {
  useCreateWorkflow,
  useUpdateWorkflow,
  useDeleteWorkflow,
  useExecuteWorkflow,
  useCancelExecution,
} from '../hooks/useWorkflows';
import { useWorkflowLogs } from '../hooks/useWorkflowLogs';
import { Workflow, WorkflowNode } from '@/types';
import { WorkflowExecution, NodeExecution } from '../api/workflows.api';
import { useWorkflowExecutionStore, NodeStatus, NodeTurn } from '../store/workflowExecution.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore';
import { writeFileAtPath, useWorkspace } from '@/features/workspace/hooks/useWorkspace';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Save,
  Play,
  Trash2,
  Terminal,
  ChevronLeft,
  PanelRightClose,
  PanelRightOpen,
  X,
  FileJson,
  Wrench,
  Bot,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  ArrowDownToLine,
  ArrowUpFromLine,
  Workflow as WorkflowIcon,
  ExternalLink,
  MessageCircleQuestion,
  User,
  GitCommitHorizontal,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExecutionLogsPanel } from './ExecutionLogsPanel';
import { SubWorkflowExecutionPanel } from './SubWorkflowExecutionPanel';
import { WorkflowIOPanel, WorkflowIOField } from './WorkflowIOPanel';
import { useRouter, useSearchParams } from 'next/navigation';
import { useExecution } from '../hooks/useWorkflows';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AgentReplyBar, QuestionType } from './AgentReplyBar';
import { StructuredDataViewer, deepParse } from './StructuredDataViewer';

function isJSON(value: string): boolean {
  const trimmed = value.trim();
  return (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  );
}

function tryParseJSON(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

interface WorkflowEditorProps {
  workflow?: Workflow;
}

const STATUS_OPTIONS = ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;
const STATUS_VARIANT: Record<
  string,
  'default' | 'success' | 'destructive' | 'warning' | 'secondary'
> = {
  DRAFT: 'secondary',
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  ARCHIVED: 'secondary',
};

// ─── Collapsible section helper ─────────────────────────────────────────────
function Section({
  title,
  icon,
  accent = 'neutral',
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  accent?: 'amber' | 'violet' | 'sky' | 'emerald' | 'neutral';
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const accentMap = {
    amber: 'text-amber-500 border-amber-500/20 bg-amber-500/5',
    violet: 'text-violet-500 border-violet-500/20 bg-violet-500/5',
    sky: 'text-sky-500 border-sky-500/20 bg-sky-500/5',
    emerald: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5',
    neutral: 'text-muted-foreground border-border/40 bg-muted/20',
  };
  return (
    <div className={`rounded-lg border ${accentMap[accent]} overflow-hidden`}>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        <span className="text-xs font-semibold flex-1">{title}</span>
        {count !== undefined && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-current/10 opacity-70 font-mono">
            {count}
          </span>
        )}
        {open ? (
          <ChevronDown className="h-3 w-3 opacity-60" />
        ) : (
          <ChevronRight className="h-3 w-3 opacity-60" />
        )}
      </button>
      {open && <div className="px-3 pb-3 pt-1 border-t border-current/10">{children}</div>}
    </div>
  );
}

// ─── Rich node execution data panel ─────────────────────────────────────────
function NodeExecutionDataPanel({
  selectedNodeId,
  selectedNodeName,
  nodeStatuses,
  nodeData,
  nodeTurns,
}: {
  selectedNodeId: string | null;
  selectedNodeName: string | null;
  nodeStatuses: Record<string, string>;
  nodeData: Record<string, unknown>;
  nodeTurns: Record<string, NodeTurn[]>;
}) {
  const { t } = useTranslation();

  if (!selectedNodeId) {
    return (
      <div className="flex h-full items-center justify-center min-h-[120px] text-sm text-muted-foreground italic p-4">
        {t(
          'workflows.editor.selectNodeMsg',
          'Select a node on the canvas to view its execution data.',
        )}
      </div>
    );
  }

  if (!nodeStatuses[selectedNodeId]) {
    return (
      <div className="flex h-full items-center justify-center min-h-[120px] text-sm text-muted-foreground p-4">
        {selectedNodeName ? `Node '${selectedNodeName}'` : 'Node'} [{selectedNodeId}] has not
        executed yet.
      </div>
    );
  }

  const turns = nodeTurns[selectedNodeId] ?? [];
  const hasInteraction = turns.some((t) => t.status === 'WAITING_INPUT');

  // ── Multi-turn timeline view (when node had at least one WAITING_INPUT) ──
  if (hasInteraction && turns.length > 1) {
    const nodeStatus = nodeStatuses[selectedNodeId];
    return (
      <div className="flex flex-col gap-2 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-sm">
            Node:{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded mr-1">
              {selectedNodeName || 'Unknown'}
            </code>
            <span className="text-muted-foreground text-xs font-normal">[{selectedNodeId}]</span>
          </span>
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
        </div>

        {/* Timeline */}
        <div className="relative flex flex-col gap-0">
          {turns
            // Skip RUNNING turns that come right after WAITING_INPUT (just "resuming…" noise)
            // but keep the RUNNING turn that comes from user reply (it carries userResponse)
            .filter((turn, idx) => {
              if (turn.status === 'RUNNING') {
                const prev = turns[idx - 1];
                // Keep only the RUNNING that follows a WAITING_INPUT (user reply context)
                return prev?.status === 'WAITING_INPUT';
              }
              return true;
            })
            .map((turn, idx, filtered) => {
              const raw = turn.data as Record<string, unknown> | undefined;
              const isWaiting = turn.status === 'WAITING_INPUT';
              const isResume = turn.status === 'RUNNING' && idx > 0;
              const isCompleted = turn.status === 'COMPLETED';
              const isFailed = turn.status === 'FAILED';
              const isLast = idx === filtered.length - 1;

              return (
                <div key={idx} className="flex gap-3">
                  {/* Timeline spine */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 border-2',
                        isWaiting
                          ? 'bg-blue-500/10 border-blue-500/40 text-blue-500'
                          : isResume
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                            : isCompleted
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                              : isFailed
                                ? 'bg-red-500/10 border-red-500/40 text-red-500'
                                : 'bg-muted border-border/60 text-muted-foreground',
                      )}
                    >
                      {isWaiting ? (
                        <MessageCircleQuestion className="h-3.5 w-3.5" />
                      ) : isResume ? (
                        <User className="h-3.5 w-3.5" />
                      ) : isCompleted || isFailed ? (
                        <Bot className="h-3.5 w-3.5" />
                      ) : (
                        <GitCommitHorizontal className="h-3.5 w-3.5" />
                      )}
                    </div>
                    {!isLast && (
                      <div className="w-px flex-1 bg-border/50 my-1" style={{ minHeight: 16 }} />
                    )}
                  </div>

                  {/* Turn card */}
                  <div className="flex-1 pb-3">
                    <div
                      className={cn(
                        'rounded-xl border p-3 space-y-2 text-sm',
                        isWaiting
                          ? 'border-blue-500/25 bg-blue-500/5'
                          : isResume
                            ? 'border-emerald-500/20 bg-emerald-500/5'
                            : isCompleted
                              ? 'border-border/50 bg-muted/20'
                              : isFailed
                                ? 'border-red-500/20 bg-red-500/5'
                                : 'border-border/40 bg-background',
                      )}
                    >
                      {/* Turn label + timestamp */}
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'text-[10px] font-semibold uppercase tracking-wide',
                            isWaiting
                              ? 'text-blue-500'
                              : isResume
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : isCompleted
                                  ? 'text-muted-foreground'
                                  : isFailed
                                    ? 'text-red-500'
                                    : 'text-muted-foreground',
                          )}
                        >
                          {isWaiting
                            ? '💬 Agent asked'
                            : isResume
                              ? '👤 User replied'
                              : isCompleted
                                ? '✅ Final response'
                                : isFailed
                                  ? '❌ Failed'
                                  : turn.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60 font-mono">
                          {new Date(turn.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      {/* WAITING_INPUT: show agent message + question */}
                      {isWaiting &&
                        (() => {
                          const agentMsg = raw?.agentMessage as string | undefined;
                          const question = raw?.prompt as string | undefined;
                          const proposals = raw?.proposals as string[] | undefined;
                          return (
                            <>
                              {agentMsg && (
                                <div className="text-xs leading-relaxed text-foreground/80 prose prose-sm dark:prose-invert max-w-none">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {agentMsg}
                                  </ReactMarkdown>
                                </div>
                              )}
                              {question && (
                                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 border-l-2 border-blue-400 pl-2">
                                  {question}
                                </p>
                              )}
                              {proposals && proposals.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {proposals.map((p, pi) => (
                                    <span
                                      key={pi}
                                      className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300"
                                    >
                                      {p}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </>
                          );
                        })()}

                      {/* RUNNING after WAITING: show user response */}
                      {isResume &&
                        (() => {
                          const userResponse = raw?.userResponse as string | undefined;
                          const question = raw?.prompt as string | undefined;
                          return (
                            <>
                              {question && (
                                <p className="text-[10px] text-muted-foreground italic">
                                  Re: {question}
                                </p>
                              )}
                              {userResponse && (
                                <p className="text-xs font-medium text-foreground bg-emerald-500/10 rounded px-2 py-1 border border-emerald-500/20">
                                  {userResponse}
                                </p>
                              )}
                            </>
                          );
                        })()}

                      {/* COMPLETED: show final agent response */}
                      {(isCompleted || isFailed) &&
                        (() => {
                          const output = deepParse(raw?.output) as
                            | Record<string, unknown>
                            | string
                            | undefined;
                          const agentText = (() => {
                            if (typeof output === 'string') return output;
                            if (typeof output === 'object' && output !== null) {
                              const o = (output as Record<string, unknown>).output;
                              if (typeof o === 'string') return o;
                            }
                            return undefined;
                          })();
                          const err = raw?.error as string | undefined;
                          return (
                            <>
                              {err && <p className="text-xs text-destructive">{err}</p>}
                              {agentText && (
                                <div className="text-xs leading-relaxed text-foreground/80 prose prose-sm dark:prose-invert max-w-none">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {agentText}
                                  </ReactMarkdown>
                                </div>
                              )}
                              {!agentText && !err && (
                                <StructuredDataViewer data={raw?.output} className="min-h-[60px]" />
                              )}
                            </>
                          );
                        })()}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    );
  }

  // ── Single-turn view (no interruption) — existing layout ─────────────────
  const raw = nodeData[selectedNodeId] as Record<string, unknown> | undefined;
  const input = raw?.input as Record<string, unknown> | string | undefined;
  const output = raw?.output as Record<string, unknown> | string | undefined;
  const consoleLogs = raw?.logs as string[] | undefined;

  // Detect structured agent output
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

  const nodeStatus = nodeStatuses[selectedNodeId];

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Header */}
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
        </div>
      </div>

      {/* Input */}
      <Section
        title="Input"
        icon={<ArrowDownToLine className="h-3.5 w-3.5" />}
        accent="sky"
        defaultOpen={false}
      >
        <pre className="text-[11px] font-mono overflow-auto max-h-40 text-foreground/80 mt-1 whitespace-pre-wrap break-all">
          {input !== undefined ? JSON.stringify(input, null, 2) : 'No input recorded.'}
        </pre>
      </Section>

      {/* Agent text output */}
      {agentText && (
        <Section
          title="Agent Response"
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          accent="emerald"
        >
          <p className="text-xs leading-relaxed text-foreground/80 mt-1 whitespace-pre-wrap">
            {agentText}
          </p>
        </Section>
      )}

      {/* Tool Calls */}
      {toolCalls && toolCalls.length > 0 && (
        <Section
          title="Tool Calls"
          icon={<Wrench className="h-3.5 w-3.5" />}
          accent="amber"
          count={toolCalls.length}
        >
          <div className="space-y-2 mt-1">
            {toolCalls.map((tc, i) => (
              <div
                key={i}
                className="rounded-md border border-amber-500/20 bg-background/60 p-2 space-y-1"
              >
                <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Wrench className="h-3 w-3" /> {tc.name}
                </p>
                {tc.arguments !== undefined && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Arguments</p>
                    <pre className="text-[10px] font-mono bg-muted/40 rounded px-2 py-1 overflow-auto max-h-24 whitespace-pre-wrap break-all">
                      {typeof tc.arguments === 'string'
                        ? tc.arguments
                        : JSON.stringify(tc.arguments, null, 2)}
                    </pre>
                  </div>
                )}
                {tc.result !== undefined && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Result</p>
                    <pre className="text-[10px] font-mono bg-emerald-500/5 border border-emerald-500/20 rounded px-2 py-1 overflow-auto max-h-24 whitespace-pre-wrap break-all text-emerald-700 dark:text-emerald-400">
                      {typeof tc.result === 'string'
                        ? tc.result
                        : JSON.stringify(tc.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Sub-agent results */}
      {subAgentResults && subAgentResults.length > 0 && (
        <Section
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
        </Section>
      )}

      {/* Console logs */}
      {consoleLogs && consoleLogs.length > 0 && (
        <Section
          title="Console Logs"
          icon={<Terminal className="h-3.5 w-3.5" />}
          accent="neutral"
          count={consoleLogs.length}
          defaultOpen={false}
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
        </Section>
      )}

      {/* Sub-workflow execution info (only for SUBWORKFLOW node type) */}
      {(() => {
        const rawData = nodeData[selectedNodeId] as Record<string, unknown> | undefined;
        const output = rawData?.output as Record<string, unknown> | undefined;
        const subExecId = output?._subExecutionId as string | undefined;
        const subWfName = output?._subWorkflowName as string | undefined;
        const subWfId = output?._subWorkflowId as string | undefined;
        if (!subExecId) return null;
        return (
          <Section
            title={`Sub-Workflow: ${subWfName ?? subWfId}`}
            icon={<WorkflowIcon className="h-3.5 w-3.5 text-blue-500" />}
            accent="sky"
          >
            <div className="mt-1 space-y-2">
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                <span className="text-muted-foreground">Child Execution ID</span>
                <code className="font-mono text-[10px] text-foreground/80 truncate">
                  {subExecId}
                </code>
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
          </Section>
        );
      })()}

      {/* Raw output fallback (no structured data) */}
      {!agentText && !toolCalls && !subAgentResults && (
        <Section
          title="Raw Output"
          icon={<ArrowUpFromLine className="h-3.5 w-3.5" />}
          accent="neutral"
          defaultOpen
        >
          <pre className="text-[11px] font-mono overflow-auto max-h-48 text-foreground/80 mt-1 whitespace-pre-wrap break-all">
            {output !== undefined ? JSON.stringify(output, null, 2) : 'No output recorded.'}
          </pre>
        </Section>
      )}
    </div>
  );
}

export function WorkflowEditor({ workflow }: WorkflowEditorProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string;
        const data = JSON.parse(json);

        if (data.name) setName(data.name);
        if (data.description) setDescription(data.description);

        const payload = {
          name: data.name || name,
          description: data.description || description,
          definition: data.definition || { nodes: [], edges: [], version: 1 },
          status: data.status || status,
        };

        if (workflow?.id) {
          updateWorkflow.mutate({ id: workflow.id, workflow: payload });
        } else {
          createWorkflow.mutate(payload);
        }

        toast.success(t('workflows.editor.importSuccess', 'Workflow imported successfully!'));
      } catch (err) {
        toast.error(`Invalid JSON file: ${err instanceof Error ? err.message : String(err)}`);
      }

      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const SEARCH_PARAMS = useSearchParams();
  const deepExecutionId = SEARCH_PARAMS.get('executionId');

  const [name, setName] = useState(workflow?.name ?? '');
  const [description, setDescription] = useState(workflow?.description ?? '');
  const [status, setStatus] = useState(workflow?.status?.toUpperCase() ?? 'DRAFT');
  const [logsOpen, setLogsOpen] = useState(!!deepExecutionId);
  const [panelOpen, setPanelOpen] = useState(false);
  const [outputLogsToFile, setOutputLogsToFile] = useState(false);

  // ─── Workflow I/O Contract ─────────────────────────────────────────
  const [inputSchema, setInputSchema] = useState<WorkflowIOField[]>(
    (workflow?.definition?.inputSchema as WorkflowIOField[] | undefined) ?? [],
  );
  const [outputSchema, setOutputSchema] = useState<WorkflowIOField[]>(
    (workflow?.definition?.outputSchema as WorkflowIOField[] | undefined) ?? [],
  );

  const setActiveExecutionId = useWorkflowExecutionStore((s) => s.setActiveExecutionId);
  const activeExecutionId = useWorkflowExecutionStore((s) => s.activeExecutionId);
  const selectedNodeId = useWorkflowExecutionStore((s) => s.selectedNodeId);
  const selectedNodeName = useWorkflowExecutionStore((s) => s.selectedNodeName);
  const nodeData = useWorkflowExecutionStore((s) => s.nodeData);
  const nodeTurns = useWorkflowExecutionStore((s) => s.nodeTurns);
  const nodeStatuses = useWorkflowExecutionStore((s) => s.nodeStatuses);
  const subExecutions = useWorkflowExecutionStore((s) => s.subExecutions);

  // ─── Derived: waiting-input node ──────────────────────────────────
  const waitingNodeId =
    Object.keys(nodeStatuses).find((id) => nodeStatuses[id] === 'WAITING_INPUT') ?? null;
  const waitingNodeRaw = waitingNodeId
    ? (nodeData[waitingNodeId] as Record<string, unknown> | undefined)
    : undefined;
  const waitingPrompt = (waitingNodeRaw?.prompt as string | undefined) ?? null;
  const waitingAgentText = (waitingNodeRaw?.agentMessage as string | undefined) ?? null;
  const waitingProposals = (waitingNodeRaw?.proposals as string[] | undefined) ?? [];
  const waitingQuestionType = (waitingNodeRaw?.questionType as QuestionType | undefined) ?? 'custom';

  const [activeExecution, setActiveExecution] = useState<WorkflowExecution | null>(null);

  // ─── Initial Deep Link Sync ──────────────────────────────────────────
  useEffect(() => {
    if (deepExecutionId) {
      setActiveExecutionId(deepExecutionId);
    }
  }, [deepExecutionId, setActiveExecutionId]);

  // If we have a deep-linked execution, fetch its latest state
  const { data: executionData } = useExecution(deepExecutionId);

  // Sync execution data to store
  useEffect(() => {
    if (executionData) {
      const store = useWorkflowExecutionStore.getState();

      // Set overall status
      store.setExecutionStatus(executionData.status);

      // Populate nodes
      if (executionData.nodeExecutions) {
        executionData.nodeExecutions.forEach((ne: NodeExecution) => {
          store.setNodeStatus(ne.nodeId, ne.status as NodeStatus);
          if (ne.output !== undefined || ne.error !== undefined) {
            store.setNodeData(ne.nodeId, {
              input: ne.input,
              output: ne.output,
              error: ne.error,
            });
          }
        });
      }

      // Sync local activeExecution so we can cancel it etc. Defer to avoid cascading render warning.
      queueMicrotask(() => {
        setActiveExecution(executionData as WorkflowExecution);
      });
    }
  }, [executionData]);

  const [bottomPanelHeight, setBottomPanelHeight] = useState(350);

  const handleDragStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = bottomPanelHeight;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaY = startY - moveEvent.clientY;
        setBottomPanelHeight(
          Math.max(150, Math.min(window.innerHeight - 100, startHeight + deltaY)),
        );
      };

      const handlePointerUp = () => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    },
    [bottomPanelHeight],
  );

  const createWorkflow = useCreateWorkflow();
  const updateWorkflow = useUpdateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();
  const executeWorkflow = useExecuteWorkflow();
  const cancelExecution = useCancelExecution();

  const { logs, connected, executionStatus, clearLogs } = useWorkflowLogs({
    executionId: activeExecution?.id ?? null,
  });
  const { refreshTree, ensureWorkspacePermission } = useWorkspace();

  // ─── Save ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    const workflowData = {
      name,
      description,
      definition: {
        nodes:
          workflow?.definition?.nodes && workflow.definition.nodes.length > 0
            ? workflow.definition.nodes
            : ([
                {
                  id: uuidv4(),
                  type: 'START',
                  data: { label: t('workflows.editor.start'), nodeType: 'START' },
                  position: { x: 100, y: 150 },
                  config: {},
                },
                {
                  id: uuidv4(),
                  type: 'END',
                  data: { label: t('workflows.editor.end'), nodeType: 'END' },
                  position: { x: 600, y: 150 },
                  config: {},
                },
              ] as WorkflowNode[]),
        edges: workflow?.definition?.edges ?? [],
        version: workflow?.definition?.version ?? 1,
        inputSchema,
        outputSchema,
      },
      status: status.toUpperCase() as Workflow['status'],
    };

    const activeWs = useWorkspaceStore.getState().getActiveWorkspace?.() ?? null;
    if (activeWs?.rootHandle) {
      try {
        const ok = await ensureWorkspacePermission(activeWs.id, 'readwrite');
        if (!ok) {
          toast.error(t('workspace.permissionDenied', 'Permission denied. Cannot save locally.'));
        } else {
          const rawName = name || workflow?.id || 'untitled_workflow';
          const fileName = `${rawName.replace(/\s+/g, '_').toLowerCase()}.json`;
          await writeFileAtPath(
            activeWs.rootHandle,
            fileName,
            JSON.stringify(workflowData, null, 2),
          );
          await refreshTree(activeWs.id);
          toast.success(`Saved to workspace locally: ${fileName}`);
        }
      } catch (err) {
        toast.error(`Failed to save locally: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (workflow?.id) {
      updateWorkflow.mutate({ id: workflow.id, workflow: workflowData });
    } else {
      createWorkflow.mutate(workflowData);
    }
  };

  // ─── Execute ──────────────────────────────────────────────────────
  const handleExecute = () => {
    if (!workflow?.id) return;
    clearLogs();
    setLogsOpen(true);

    // Automatically inject active workspace local path as CWD for shell commands
    const activeWs = useWorkspaceStore.getState().getActiveWorkspace?.() ?? null;

    const input = {
      ...(activeWs?.nativePath ? { cwd: activeWs.nativePath } : {}),
      ...(activeWs?.id ? { workspaceId: activeWs.id } : {}),
      ...(outputLogsToFile ? { outputLogsToFile: true } : {}),
    };

    executeWorkflow.mutate(
      { id: workflow.id, input },
      {
        onSuccess: (execution) => {
          setActiveExecution(execution);
          setActiveExecutionId(execution.id);
        },
      },
    );
  };

  // ─── Cancel execution ─────────────────────────────────────────────
  const handleCancelExecution = () => {
    if (!activeExecution) return;
    cancelExecution.mutate(activeExecution.id, {
      onSuccess: () => {
        setActiveExecution(null);
        setActiveExecutionId(null);
      },
    });
  };

  const handleToggleLogs = () => {
    setLogsOpen((v) => !v);
  };

  const isSaving = createWorkflow.isPending || updateWorkflow.isPending;

  return (
    <div className="flex flex-col h-full w-full pointer-events-none z-50 overflow-hidden relative">
      {/* ─── Global Overlay for WAITING_INPUT ─── */}
      {waitingNodeId && (activeExecution || activeExecutionId) && (
        <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/20 backdrop-blur-sm pointer-events-auto transition-opacity animate-in fade-in">
          <Card
            className={cn(
              'w-[560px] shadow-2xl backdrop-blur-xl border-border/50 animate-in zoom-in-95',
              waitingQuestionType === 'danger_choice'
                ? 'bg-white/95 dark:bg-black/95 border-red-500/30'
                : 'bg-white/90 dark:bg-black/90',
            )}
          >
            <CardHeader className="pb-2 border-b border-border/50">
              <CardTitle
                className={cn(
                  'flex items-center gap-2 text-sm',
                  waitingQuestionType === 'danger_choice' ? 'text-red-500' : 'text-blue-500',
                )}
              >
                <MessageCircleQuestion className="h-4 w-4 shrink-0" />
                {waitingQuestionType === 'danger_choice'
                  ? 'Dangerous Action — Confirmation Required'
                  : 'Agent Needs Your Input'}
              </CardTitle>
              {/* Short question as subtitle */}
              {waitingPrompt && (
                <p
                  className={cn(
                    'text-sm font-semibold mt-1 leading-snug',
                    waitingQuestionType === 'danger_choice'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-foreground',
                  )}
                >
                  {waitingPrompt}
                </p>
              )}
            </CardHeader>
            <CardContent className="pt-4 max-h-[70vh] overflow-y-auto space-y-3">
              {/* Agent body text (explanation above the question) */}
              {waitingAgentText &&
                waitingAgentText !== waitingPrompt &&
                (isJSON(waitingAgentText) ? (
                  <StructuredDataViewer
                    data={tryParseJSON(waitingAgentText)}
                    className="min-h-[80px]"
                  />
                ) : (
                  <div className="text-sm leading-relaxed text-foreground/80 prose prose-sm dark:prose-invert max-w-none border-l-2 border-border/60 pl-3">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{waitingAgentText}</ReactMarkdown>
                  </div>
                ))}
              <AgentReplyBar
                nodeId={waitingNodeId!}
                executionId={activeExecution?.id ?? activeExecutionId}
                agentText={waitingAgentText ?? undefined}
                externalProposals={waitingProposals}
                questionType={waitingQuestionType}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Header ─── */}
      <div className="flex items-center justify-between gap-3 flex-wrap p-2 px-4 rounded-xl bg-white/30 dark:bg-black/40 backdrop-blur-md border border-border/50 shadow-sm pointer-events-auto shrink-0 mb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => router.push('/workflows')}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-2xl font-bold">
            {workflow ? t('workflows.editor.edit') : t('workflows.editor.new')}
          </h2>
          {workflow && <Badge variant={STATUS_VARIANT[status] ?? 'default'}>{status}</Badge>}
        </div>

        <div className="flex items-center gap-2">
          {/* Execute */}
          {workflow?.id && (
            <Button
              variant="outline"
              onClick={handleExecute}
              disabled={executeWorkflow.isPending || status !== 'ACTIVE'}
              className="gap-2"
              title={
                status !== 'ACTIVE'
                  ? t('workflows.editor.activateToRun')
                  : t('workflows.actions.run')
              }
            >
              <Play className="h-4 w-4" />
              {executeWorkflow.isPending
                ? t('workflows.editor.running')
                : t('workflows.actions.run')}
            </Button>
          )}

          {/* Logs toggle */}
          {workflow?.id && (
            <Button
              variant={logsOpen ? 'secondary' : 'ghost'}
              size="icon"
              onClick={handleToggleLogs}
              title={t('workflows.editor.toggleLogs')}
            >
              <Terminal className="h-4 w-4" />
            </Button>
          )}

          {/* Output logs to file toggle */}
          {workflow?.id && (
            <div className="flex items-center gap-2 border-l border-border/50 pl-3 ml-1">
              <input
                type="checkbox"
                id="outputLogsToFile"
                checked={outputLogsToFile}
                onChange={(e) => setOutputLogsToFile(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 pointer-events-auto"
                title="Output logs into workspace logs/ folder"
              />
              <label
                htmlFor="outputLogsToFile"
                className="text-sm cursor-pointer whitespace-nowrap"
              >
                Output Logs
              </label>
            </div>
          )}

          {/* Import JSON */}
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            aria-hidden="true"
            className="hidden"
            onChange={handleImport}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
            <ArrowDownToLine className="h-4 w-4" />
            {t('workflows.editor.import', 'Import JSON')}
          </Button>

          {/* Save */}
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? t('workflows.editor.saving') : t('workflows.editor.save')}
          </Button>

          {/* Delete */}
          {workflow?.id && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('workflows.editor.deleteTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('workflows.editor.deleteDesc')?.replace('{name}', workflow.name)}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('workflows.editor.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive hover:bg-destructive/90"
                    onClick={() => deleteWorkflow.mutate(workflow.id)}
                  >
                    {t('workflows.editor.delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {/* Toggle Panel */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPanelOpen(!panelOpen)}
            title="Toggle Details Panel"
            className="ml-2 text-muted-foreground hover:text-foreground"
          >
            {panelOpen ? (
              <PanelRightClose className="h-5 w-5" />
            ) : (
              <PanelRightOpen className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* ─── Main Content Area (Right Panel floating) ─── */}
      <div className="flex-1 relative flex justify-end w-full overflow-hidden">
        {panelOpen && (
          <div className="w-[400px] h-full flex flex-col gap-4 overflow-y-auto pointer-events-auto pb-4 pr-1">
            {/* ─── Details ─── */}
            <Card className="backdrop-blur-xl bg-white/40 dark:bg-black/40 border-border/50 shadow-xl shrink-0 pointer-events-auto">
              <CardHeader>
                <CardTitle className="text-base">{t('workflows.editor.details')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="wf-name" className="text-sm font-medium">
                      {t('workflows.editor.nameLabel')}
                    </label>
                    <Input
                      id="wf-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('workflows.editor.namePlaceholder')}
                      required
                    />
                  </div>
                  {workflow && (
                    <div className="space-y-2">
                      <label htmlFor="wf-status" className="text-sm font-medium">
                        {t('workflows.editor.status')}
                      </label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger id="wf-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label htmlFor="wf-description" className="text-sm font-medium">
                    {t('workflows.editor.descLabel')}
                  </label>
                  <Textarea
                    id="wf-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('workflows.editor.descPlaceholder')}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* ─── I/O Contract ─── */}
            <Card className="backdrop-blur-xl bg-white/40 dark:bg-black/40 border-border/50 shadow-xl shrink-0 pointer-events-auto">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <span>{i18n.language.startsWith('fr') ? 'Contrat I/O' : 'I/O Contract'}</span>
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {inputSchema.length + outputSchema.length} fields
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WorkflowIOPanel
                  inputSchema={inputSchema}
                  outputSchema={outputSchema}
                  onInputChange={setInputSchema}
                  onOutputChange={setOutputSchema}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ─── Bottom Panel (Execution & Node Data) ─── */}
      {logsOpen && workflow?.id && (
        <div
          className="relative w-full shrink-0 shadow-xl rounded-t-xl overflow-hidden border border-border/50 bg-white/60 dark:bg-black/60 backdrop-blur-xl pointer-events-auto flex flex-col"
          style={{ height: bottomPanelHeight }}
        >
          {/* Resize Handle */}
          <div
            className="absolute top-0 left-0 right-0 h-[6px] cursor-row-resize z-50 bg-transparent hover:bg-primary/20 transition-colors"
            onPointerDown={handleDragStart}
          />
          <Tabs defaultValue="logs" className="flex-1 flex flex-col min-h-0 pt-1">
            <div className="flex items-center justify-between px-4 pt-2 border-b border-border/50 pb-2">
              <TabsList className="bg-background/50 backdrop-blur-sm">
                <TabsTrigger value="logs" className="gap-2 text-xs">
                  <Terminal className="h-3.5 w-3.5" />
                  Execution Logs
                </TabsTrigger>
                <TabsTrigger value="node-data" className="gap-2 text-xs">
                  <FileJson className="h-3.5 w-3.5" />
                  Node Execution Data
                </TabsTrigger>
                <TabsTrigger value="sub-workflows" className="gap-2 text-xs">
                  <WorkflowIcon className="h-3.5 w-3.5 text-blue-500" />
                  Sub-Workflows
                  {subExecutions.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-500 text-[10px] font-mono">
                      {subExecutions.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setLogsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <TabsContent
              value="logs"
              className="flex-1 min-h-0 m-0 border-0 p-0 overflow-hidden outline-none flex flex-col"
            >
              <ExecutionLogsPanel
                logs={logs}
                connected={connected}
                executionStatus={executionStatus}
                executionId={activeExecution?.id ?? null}
                onClear={clearLogs}
                onCancel={handleCancelExecution}
                isCancelling={cancelExecution.isPending}
              />
            </TabsContent>

            <TabsContent
              value="node-data"
              className="flex-1 min-h-0 m-0 border-0 overflow-hidden outline-none flex flex-col"
            >
              <ScrollArea className="h-full">
                <NodeExecutionDataPanel
                  selectedNodeId={selectedNodeId}
                  selectedNodeName={selectedNodeName}
                  nodeStatuses={nodeStatuses}
                  nodeData={nodeData}
                  nodeTurns={nodeTurns}
                />
              </ScrollArea>
            </TabsContent>

            <TabsContent
              value="sub-workflows"
              className="flex-1 min-h-0 m-0 border-0 overflow-hidden outline-none flex flex-col"
            >
              <SubWorkflowExecutionPanel />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
