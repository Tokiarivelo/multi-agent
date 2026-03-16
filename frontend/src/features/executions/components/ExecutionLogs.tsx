import { useTranslation } from 'react-i18next';
import { useExecutionLogs } from '../hooks/useExecutions';
import { useExecutionStore } from '@/store/execution.store';
import { useTokenStream } from '@/hooks/useTokenStream';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Badge } from '@/components/ui/badge';
import { formatDate, getStatusColor } from '@/lib/utils';
import { Activity, ChevronDown, ChevronUp, Code, Terminal, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ExecutionLog } from '@/types';

interface ExecutionLogsProps {
  executionId: string;
}


function LogEntry({ log }: { log: ExecutionLog }) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const hasData = log.input || log.output || log.error;

  return (
    <div
      className={cn(
        'group flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-200 overflow-hidden',
        isExpanded ? 'border-border/80 ring-1 ring-border/5' : 'border-transparent bg-muted/20'
      )}
    >
      <div
        className={cn(
          'flex items-center gap-3 p-3 cursor-pointer select-none hover:bg-muted/40 transition-colors',
          isExpanded && 'bg-muted/40'
        )}
        onClick={() => hasData && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-center p-2 rounded-lg bg-background shadow-xs">
          <Terminal className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold truncate">
              {log.nodeName || t('workflows.logs.node')}
            </span>
            <Badge
              variant={getStatusColor(log.status)}
              className="text-[10px] uppercase tracking-wider font-bold h-5"
            >
              {log.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <span>{formatDate(log.createdAt)}</span>
            {log.startedAt && log.completedAt && (
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                {Math.round(
                  (new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 1000
                )}
                s
              </span>
            )}
          </div>
        </div>

        {hasData && (
          <div className="text-muted-foreground group-hover:text-foreground transition-colors">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        )}
      </div>

      {isExpanded && hasData && (
        <div className="p-4 pt-0 space-y-4 border-t border-border/40 animate-in fade-in slide-in-from-top-1 duration-200">
          {log.input && (
            <div className="space-y-1.5 mt-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-tight">
                <Code className="h-3 w-3" />
                {t('workflows.logs.input')}
              </div>
              <pre className="p-3 bg-background/50 border border-border/50 rounded-lg text-xs overflow-auto font-mono text-foreground/80 shadow-inner">
                {JSON.stringify(log.input, null, 2)}
              </pre>
            </div>
          )}

          {log.output && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-tight">
                <Code className="h-3 w-3" />
                {t('workflows.logs.output')}
              </div>
              <pre className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-xs overflow-auto font-mono text-emerald-900/90 dark:text-emerald-300/90 shadow-inner">
                {JSON.stringify(log.output, null, 2)}
              </pre>
            </div>
          )}

          {log.error && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-destructive uppercase tracking-tight">
                <AlertCircle className="h-3 w-3" />
                {t('workflows.logs.error')}
              </div>
              <pre className="p-3 bg-destructive/5 border border-destructive/10 rounded-lg text-xs overflow-auto font-mono text-destructive shadow-inner">
                {log.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ExecutionLogs({ executionId }: ExecutionLogsProps) {
  const { t } = useTranslation();
  const { data: logs, isLoading } = useExecutionLogs(executionId);
  const { streamingTokens } = useExecutionStore();
  const { isStreaming } = useTokenStream(executionId);

  const streamedContent = streamingTokens.get(executionId);

  return (
    <div className="space-y-6 pb-8">
      {streamedContent && (
        <Card className="overflow-hidden border-none bg-linear-to-br from-violet-500/5 via-transparent to-emerald-500/5 shadow-xl">
          <CardHeader className="border-b border-border/10 bg-background/40 backdrop-blur-xs">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2.5 text-lg font-bold">
                <div className="p-1.5 rounded-full bg-emerald-500/10 text-emerald-500 animate-pulse">
                  <Activity className="h-4 w-4" />
                </div>
                {t('workflows.logs.live_stream')}
              </CardTitle>
              {isStreaming && (
                <Badge
                  variant="success"
                  className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    {t('workflows.logs.streaming')}
                  </span>
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="p-6 text-sm whitespace-pre-wrap font-mono leading-relaxed max-h-[400px] overflow-auto custom-scrollbar bg-background/20 backdrop-blur-md">
              <span className="text-foreground/90">{streamedContent}</span>
              {isStreaming && (
                <span className="inline-block w-2 h-4 bg-emerald-500 ml-1 animate-caret"></span>
              )}
            </pre>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Terminal className="h-5 w-5 text-violet-500" />
            {t('workflows.logs.title')}
          </h3>
          {logs?.total !== undefined && (
            <Badge variant="secondary" className="font-mono px-2 py-0 border-transparent shadow-none">
              {logs.total}
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-2xl border border-dashed border-border/60">
            <LoadingSpinner className="h-10 w-10 text-violet-500" />
            <p className="mt-4 text-sm text-muted-foreground">{t('workflows.logs.waiting')}</p>
          </div>
        ) : !logs?.data || logs.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-muted/20 rounded-2xl border border-dashed border-border/60 text-center">
            <div className="p-3 rounded-full bg-background shadow-xs mb-4">
              <Activity className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-foreground/80">{t('workflows.logs.no_logs')}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
              {t('workflows.logs.emptyMsg')}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {logs.data.map((log: ExecutionLog) => (
              <LogEntry key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
