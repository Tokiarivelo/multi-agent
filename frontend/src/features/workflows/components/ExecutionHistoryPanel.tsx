'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useWorkflowExecutions } from '../hooks/useWorkflows';
import { ExecutionDetailModal } from './ExecutionDetailModal';
import type { WorkflowExecutionSummary } from '../api/workflows.api';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';

interface Props {
  workflowId: string;
}

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: 'bg-green-500/20 text-green-400 border-green-500/30',
  FAILED: 'bg-red-500/20 text-red-400 border-red-500/30',
  RUNNING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  CANCELLED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export function ExecutionHistoryPanel({ workflowId }: Props) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<10 | 25 | 50>(10);
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecutionSummary | null>(null);

  const { data, isLoading, isError } = useWorkflowExecutions(workflowId, page, limit);

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Tokens</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {isError && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-destructive py-8">
                  Failed to load execution history.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !isError && data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No executions yet. Run the workflow to see history.
                </TableCell>
              </TableRow>
            )}
            {data?.data.map((exec) => (
              <TableRow key={exec.executionId}>
                <TableCell className="text-sm">{formatDate(exec.startedAt ?? exec.createdAt)}</TableCell>
                <TableCell>
                  <Badge className={STATUS_STYLES[exec.status] ?? ''}>
                    {exec.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm font-mono">
                  {exec.totalTokens > 0 ? exec.totalTokens.toLocaleString() : '—'}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatDuration(exec.duration)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedExecution(exec)}
                    className="h-7 px-2"
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <Select
              value={String(limit)}
              onValueChange={(v) => {
                setLimit(Number(v) as 10 | 25 | 50);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-7 w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span>
              {(page - 1) * limit + 1}–{Math.min(page * limit, data.total)} of {data.total}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <ExecutionDetailModal
        execution={selectedExecution}
        onClose={() => setSelectedExecution(null)}
      />
    </div>
  );
}
