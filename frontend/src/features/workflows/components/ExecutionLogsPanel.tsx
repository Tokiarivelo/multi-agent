'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Wifi, WifiOff, XCircle, Copy, Check, ExternalLink } from 'lucide-react';
import { ExecutionLogLine } from '../hooks/useWorkflowLogs';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const WORKSPACE_SETUP_SENTINEL = '[WORKSPACE_SETUP_REQUIRED]';

interface ExecutionLogsPanelProps {
  logs: ExecutionLogLine[];
  connected: boolean;
  executionStatus: string | null;
  executionId: string | null;
  onClear: () => void;
  onCancel?: () => void;
  isCancelling?: boolean;
}

const LOG_TYPE_CLASSES: Record<ExecutionLogLine['type'], string> = {
  connected: 'text-muted-foreground',
  subscribed: 'text-sky-500 dark:text-sky-400',
  node_update: 'text-foreground',
  execution_update: 'text-violet-600 dark:text-violet-400 font-medium',
  error: 'text-destructive font-medium',
};

const STATUS_VARIANT: Record<
  string,
  'default' | 'success' | 'destructive' | 'warning' | 'secondary'
> = {
  PENDING: 'secondary',
  RUNNING: 'warning',
  COMPLETED: 'success',
  FAILED: 'destructive',
  CANCELLED: 'secondary',
};

export function ExecutionLogsPanel({
  logs,
  connected,
  executionStatus,
  executionId,
  onClear,
  onCancel,
  isCancelling,
}: ExecutionLogsPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /** Renders a log message, replacing workspace-setup errors with an actionable link */
  const renderMessage = (message: string) => {
    if (message.includes(WORKSPACE_SETUP_SENTINEL)) {
      const clean = message.replace(WORKSPACE_SETUP_SENTINEL, '').trim();
      return (
        <span>
          {clean}{' '}
          <button
            onClick={() => router.push('/workspace')}
            className="inline-flex items-center gap-1 text-amber-500 hover:text-amber-400 underline underline-offset-2 font-medium transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            {t('workspace.goToWorkspace', 'Go to Workspace →')}
          </button>
        </span>
      );
    }
    return <span>{message}</span>;
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    const allText = logs.map(l => `[${new Date(l.timestamp).toLocaleTimeString('en-US')}] [${l.type.toUpperCase()}] ${l.message} ${l.data ? JSON.stringify(l.data) : ''}`).join('\n');
    handleCopy(allText, 'all');
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <Card className="flex flex-col h-full bg-transparent border-0 shadow-none">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3 border-b">
        <div className="flex items-center gap-3">
          <CardTitle className="text-base">{t('workflows.logs.title')}</CardTitle>
          {executionStatus && (
            <Badge variant={STATUS_VARIANT[executionStatus] ?? 'default'}>{executionStatus}</Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Connection indicator */}
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {connected ? (
              <Wifi className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {connected ? t('workflows.logs.live') : t('workflows.logs.offline')}
          </span>

          {/* Cancel button */}
          {executionStatus === 'RUNNING' && onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isCancelling}
              className="gap-1 text-destructive hover:text-destructive h-7 text-xs"
            >
              <XCircle className="h-3 w-3" />
              {isCancelling ? t('workflows.logs.cancelling') : t('workflows.logs.cancel')}
            </Button>
          )}

          {/* Copy All button */}
          <Button variant="ghost" size="sm" onClick={handleCopyAll} className="gap-1 h-7 text-xs" disabled={logs.length === 0}>
            {copiedId === 'all' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            Copy All
          </Button>

          {/* Clear button */}
          <Button variant="ghost" size="sm" onClick={onClear} className="gap-1 h-7 text-xs">
            <Trash2 className="h-3 w-3" />
            {t('workflows.logs.clear')}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div ref={scrollRef} className="font-mono text-xs p-4 space-y-1 min-h-[200px]">
            {logs.length === 0 ? (
              <p className="text-muted-foreground italic">
                {executionId ? t('workflows.logs.waiting') : t('workflows.logs.emptyMsg')}
              </p>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex gap-2 items-start leading-relaxed',
                    LOG_TYPE_CLASSES[log.type],
                  )}
                >
                  <span className="shrink-0 text-muted-foreground/60 select-none w-20">
                    {new Date(log.timestamp).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                  <div className="flex-1 min-w-0 pr-6 relative group/log">
                    {renderMessage(log.message)}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 absolute right-0 top-0 opacity-0 group-hover/log:opacity-100 transition-opacity"
                      onClick={() => handleCopy(`${log.message} ${log.data ? JSON.stringify(log.data) : ''}`, `log-${i}`)}
                      title="Copy log entry"
                    >
                      {copiedId === `log-${i}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                    </Button>
                    {log.data && (
                      <details className="mt-1 group">
                        <summary className="cursor-pointer text-muted-foreground/60 text-[10px] uppercase font-semibold hover:text-muted-foreground select-none list-none flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
                          <span className="group-open:hidden">▶ Show Data Payload</span>
                          <span className="hidden group-open:inline">▼ Hide Data Payload</span>
                        </summary>
                        <div className="relative mt-1">
                          <pre className="text-[10px] text-muted-foreground/90 overflow-x-auto whitespace-pre-wrap rounded bg-black/10 dark:bg-white/5 p-2 border border-border/30 max-h-[300px] overflow-y-auto">
                            {typeof log.data === 'object'
                              ? JSON.stringify(log.data, null, 2)
                              : String(log.data)}
                          </pre>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/50 hover:bg-background/80"
                            onClick={(e) => {
                              e.preventDefault();
                              const dataStr = typeof log.data === 'object' ? JSON.stringify(log.data, null, 2) : String(log.data);
                              handleCopy(dataStr, `data-${i}`);
                            }}
                            title="Copy payload"
                          >
                            {copiedId === `data-${i}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                          </Button>
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
