'use client';

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Wifi, WifiOff, XCircle } from 'lucide-react';
import { ExecutionLogLine } from '../hooks/useWorkflowLogs';
import { cn } from '@/lib/utils';

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
                  <span>{log.message}</span>
                  {log.data && (
                    <span className="ml-auto text-muted-foreground/50 shrink-0">
                      {typeof log.data === 'object'
                        ? JSON.stringify(log.data).slice(0, 60)
                        : String(log.data).slice(0, 60)}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
