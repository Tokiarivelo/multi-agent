'use client';

import { Badge } from '@/components/ui/badge';
import {
  Bot,
  GitCommitHorizontal,
  MessageCircleQuestion,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StructuredDataViewer, deepParse } from './StructuredDataViewer';
import { NodeTurn } from '../store/workflowExecution.store';

export interface MultiTurnTimelineProps {
  selectedNodeId: string;
  selectedNodeName: string | null;
  turns: NodeTurn[];
  nodeStatus: string;
}

export function MultiTurnTimeline({
  selectedNodeId,
  selectedNodeName,
  turns,
  nodeStatus,
}: MultiTurnTimelineProps) {
  const filtered = turns.filter((turn, idx) => {
    if (turn.status === 'RUNNING') {
      const prev = turns[idx - 1];
      return prev?.status === 'WAITING_INPUT';
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-2 p-4">
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
            nodeStatus === 'COMPLETED' ? 'success' : nodeStatus === 'FAILED' ? 'destructive' : 'secondary'
          }
        >
          {nodeStatus}
        </Badge>
      </div>

      <div className="relative flex flex-col gap-0">
        {filtered.map((turn, idx) => {
          const raw = turn.data as Record<string, unknown> | undefined;
          const isWaiting = turn.status === 'WAITING_INPUT';
          const isResume = turn.status === 'RUNNING' && idx > 0;
          const isCompleted = turn.status === 'COMPLETED';
          const isFailed = turn.status === 'FAILED';
          const isLast = idx === filtered.length - 1;

          return (
            <div key={idx} className="flex gap-3">
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

                  {isWaiting && <WaitingTurnContent raw={raw} />}
                  {isResume && <ResumeTurnContent raw={raw} />}
                  {(isCompleted || isFailed) && <CompletedTurnContent raw={raw} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WaitingTurnContent({ raw }: { raw: Record<string, unknown> | undefined }) {
  const agentMsg = raw?.agentMessage as string | undefined;
  const question = raw?.prompt as string | undefined;
  const proposals = raw?.proposals as string[] | undefined;
  return (
    <>
      {agentMsg && (
        <div className="text-xs leading-relaxed text-foreground/80 prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{agentMsg}</ReactMarkdown>
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
}

function ResumeTurnContent({ raw }: { raw: Record<string, unknown> | undefined }) {
  const userResponse = raw?.userResponse as string | undefined;
  const question = raw?.prompt as string | undefined;
  return (
    <>
      {question && (
        <p className="text-[10px] text-muted-foreground italic">Re: {question}</p>
      )}
      {userResponse && (
        <p className="text-xs font-medium text-foreground bg-emerald-500/10 rounded px-2 py-1 border border-emerald-500/20">
          {userResponse}
        </p>
      )}
    </>
  );
}

function CompletedTurnContent({ raw }: { raw: Record<string, unknown> | undefined }) {
  const output = deepParse(raw?.output) as Record<string, unknown> | string | undefined;
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
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{agentText}</ReactMarkdown>
        </div>
      )}
      {!agentText && !err && (
        <StructuredDataViewer data={raw?.output} className="min-h-[60px]" />
      )}
    </>
  );
}
