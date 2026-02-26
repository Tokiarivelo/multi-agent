'use client';

import { Execution } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRetryExecution, useCancelExecution } from '../hooks/useExecutions';
import { formatDate, getStatusColor } from '@/lib/utils';
import { RefreshCw, X } from 'lucide-react';

interface ExecutionDetailsProps {
  execution: Execution;
}

export function ExecutionDetails({ execution }: ExecutionDetailsProps) {
  const retryExecution = useRetryExecution();
  const cancelExecution = useCancelExecution();

  const handleRetry = () => {
    retryExecution.mutate(execution.id);
  };

  const handleCancel = () => {
    cancelExecution.mutate(execution.id);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Execution Details</CardTitle>
            <div className="flex gap-2">
              {execution.status === 'failed' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  disabled={retryExecution.isPending}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
              )}
              {(execution.status === 'running' || execution.status === 'pending') && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCancel}
                  disabled={cancelExecution.isPending}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">ID</label>
              <p className="text-sm font-mono">{execution.id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="mt-1">
                <Badge
                  variant={
                    getStatusColor(execution.status) as
                      | 'default'
                      | 'success'
                      | 'warning'
                      | 'destructive'
                  }
                >
                  {execution.status}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Workflow ID</label>
              <p className="text-sm font-mono">{execution.workflowId}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created</label>
              <p className="text-sm">{formatDate(execution.createdAt)}</p>
            </div>
            {execution.startedAt && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Started</label>
                <p className="text-sm">{formatDate(execution.startedAt)}</p>
              </div>
            )}
            {execution.completedAt && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Completed</label>
                <p className="text-sm">{formatDate(execution.completedAt)}</p>
              </div>
            )}
          </div>

          {execution.input && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Input</label>
              <pre className="mt-2 p-4 bg-muted/40 border border-border/50 rounded-xl text-xs overflow-auto shadow-inner">
                {JSON.stringify(execution.input, null, 2)}
              </pre>
            </div>
          )}

          {execution.output && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Output</label>
              <pre className="mt-2 p-4 bg-muted/40 border border-border/50 rounded-xl text-xs overflow-auto shadow-inner">
                {JSON.stringify(execution.output, null, 2)}
              </pre>
            </div>
          )}

          {execution.error && (
            <div>
              <label className="text-sm font-medium text-destructive">Error</label>
              <pre className="mt-2 p-4 bg-destructive/10 rounded-md text-xs overflow-auto text-destructive">
                {execution.error}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
