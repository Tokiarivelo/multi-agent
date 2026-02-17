"use client";

import { useExecutionLogs } from "../hooks/useExecutions";
import { useExecutionStore } from "@/store/execution.store";
import { useTokenStream } from "@/hooks/useTokenStream";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Activity } from "lucide-react";

interface ExecutionLogsProps {
  executionId: string;
}

export function ExecutionLogs({ executionId }: ExecutionLogsProps) {
  const { data: logs, isLoading } = useExecutionLogs(executionId);
  const { streamingTokens } = useExecutionStore();
  const { isStreaming } = useTokenStream(executionId);

  const streamedContent = streamingTokens.get(executionId);

  return (
    <div className="space-y-4">
      {streamedContent && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-500" />
                Live Token Stream
              </CardTitle>
              {isStreaming && (
                <Badge variant="success">Streaming</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <pre className="p-4 bg-gray-50 rounded-md text-sm whitespace-pre-wrap font-mono">
              {streamedContent}
              {isStreaming && <span className="animate-pulse">▊</span>}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Execution Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingSpinner />
          ) : !logs || logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No logs available</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <Badge
                    variant={
                      log.level === "error"
                        ? "destructive"
                        : log.level === "warn"
                        ? "warning"
                        : log.level === "info"
                        ? "default"
                        : "secondary"
                    }
                    className="mt-0.5"
                  >
                    {log.level}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{log.message}</p>
                    {log.data && (
                      <pre className="mt-2 text-xs text-muted-foreground overflow-auto">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(log.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
