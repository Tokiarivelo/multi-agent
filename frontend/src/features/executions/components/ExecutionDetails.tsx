import { useTranslation } from 'react-i18next';
import { Execution } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRetryExecution, useCancelExecution } from '../hooks/useExecutions';
import { HealingPanel } from './HealingPanel';
import { formatDate, getStatusColor } from '@/lib/utils';
import { RefreshCw, X, Calendar, Clock, Hash, Activity, Terminal, AlertCircle, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExecutionDetailsProps {
  execution: Execution;
}

function InfoItem({ 
  label, 
  value, 
  icon: Icon, 
  mono = false,
  className 
}: { 
  label: string; 
  value: React.ReactNode; 
  icon?: React.ElementType; 
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className={cn(
        "text-sm font-medium",
        mono && "font-mono text-[13px] bg-muted/30 px-2 py-0.5 rounded border border-border/40 w-fit"
      )}>
        {value}
      </div>
    </div>
  );
}

export function ExecutionDetails({ execution }: ExecutionDetailsProps) {
  const { t } = useTranslation();
  const retryExecution = useRetryExecution();
  const cancelExecution = useCancelExecution();

  const handleRetry = () => {
    retryExecution.mutate(execution.id);
  };

  const handleCancel = () => {
    cancelExecution.mutate(execution.id);
  };

  const duration = execution.startedAt && execution.completedAt 
    ? Math.round((new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000)
    : null;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-none shadow-xl bg-linear-to-b from-card to-muted/10">
        <CardHeader className="border-b border-border/40 bg-muted/20 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-500 shadow-xs">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold tracking-tight">
                  {t('workflows.execution.details')}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                   {execution.workflow?.name || execution.workflowId}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              {execution.status === 'failed' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  disabled={retryExecution.isPending}
                  className="gap-2 h-9 px-4 font-semibold border-violet-500/30 text-violet-600 hover:bg-violet-500 hover:text-white transition-all shadow-sm"
                >
                  <RefreshCw className={cn("h-4 w-4", retryExecution.isPending && "animate-spin")} />
                  {t('workflows.execution.retry')}
                </Button>
              )}
              {(execution.status === 'running' || execution.status === 'pending') && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCancel}
                  disabled={cancelExecution.isPending}
                  className="gap-2 h-9 px-4 font-semibold shadow-sm hover:scale-[1.02] active:scale-95 transition-all"
                >
                  <X className="h-4 w-4" />
                  {t('workflows.execution.cancel')}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            <InfoItem 
              label={t('workflows.execution.id')} 
              value={execution.id} 
              icon={Hash} 
              mono 
              className="lg:col-span-2"
            />
            <InfoItem 
              label={t('workflows.execution.status')} 
              value={
                <Badge
                  variant={getStatusColor(execution.status)}
                  className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 h-6"
                >
                  <span className="flex items-center gap-1.5">
                    {execution.status === 'running' && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                    )}
                    {execution.status}
                  </span>
                </Badge>
              } 
              icon={Activity} 
            />
             <InfoItem 
              label={t('workflows.execution.duration')} 
              value={duration !== null ? `${duration}s` : '--'} 
              icon={Clock} 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-8 border-y border-border/40 bg-muted/5 -mx-6 px-6">
            <InfoItem 
              label={t('workflows.execution.created')} 
              value={formatDate(execution.createdAt)} 
              icon={Calendar} 
            />
            {execution.startedAt && (
              <InfoItem 
                label={t('workflows.execution.started')} 
                value={formatDate(execution.startedAt)} 
                icon={PlayCircle} 
              />
            )}
            {execution.completedAt && (
              <InfoItem 
                label={t('workflows.execution.completed')} 
                value={formatDate(execution.completedAt)} 
                icon={Clock} 
              />
            )}
          </div>

          <div className="space-y-8 mt-10">
            {execution.input && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1">
                  <Terminal className="h-3.5 w-3.5" />
                  {t('workflows.execution.input')}
                </div>
                <pre className="p-5 bg-background border border-border/60 rounded-xl text-xs font-mono overflow-auto shadow-inner leading-relaxed">
                  {JSON.stringify(execution.input, null, 2)}
                </pre>
              </div>
            )}

            {execution.output && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest px-1">
                  <PlayCircle className="h-3.5 w-3.5" />
                  {t('workflows.execution.output')}
                </div>
                <pre className="p-5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-xs font-mono overflow-auto text-emerald-900 dark:text-emerald-300 shadow-inner leading-relaxed">
                  {JSON.stringify(execution.output, null, 2)}
                </pre>
              </div>
            )}

            {execution.error && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-destructive uppercase tracking-widest px-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {t('workflows.execution.error_title')}
                  </div>
                  <pre className="p-5 bg-destructive/5 border border-destructive/20 rounded-xl text-xs font-mono overflow-auto text-destructive shadow-inner leading-relaxed">
                    {execution.error}
                  </pre>
                </div>
                <HealingPanel executionId={execution.id} executionStatus={execution.status} />
              </div>
            )}

            {!execution.error && execution.status === 'completed' && (
              <HealingPanel executionId={execution.id} executionStatus={execution.status} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
