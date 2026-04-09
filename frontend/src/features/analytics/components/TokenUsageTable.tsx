'use client';

import { useState } from 'react';
import { useTokenUsage } from '../hooks/useTokenUsage';
import { TokenUsageRecord } from '../api/analytics.api';
import { TokenUsageDetailModal } from './TokenUsageDetailModal';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  BarChart3, ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertCircle,
} from 'lucide-react';

const PAGE_SIZES = [10, 25, 50];

interface TokenUsageTableProps {
  agentId?: string;
  isTest?: boolean;
  fromDate?: string;
  toDate?: string;
}

export function TokenUsageTable({ agentId, isTest, fromDate, toDate }: TokenUsageTableProps) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [selected, setSelected] = useState<TokenUsageRecord | null>(null);

  const { data, isLoading, error } = useTokenUsage({ page, limit, agentId, isTest, fromDate, toDate });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-muted/10 rounded-3xl border border-dashed border-border/60">
        <LoadingSpinner className="h-10 w-10 text-violet-500" />
        <p className="mt-4 text-sm font-medium text-muted-foreground animate-pulse">Loading analytics…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-destructive/5 rounded-3xl border border-destructive/20 text-destructive">
        <AlertCircle className="h-10 w-10 mb-4" />
        <p className="font-semibold">Failed to load token usage</p>
      </div>
    );
  }

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div className="space-y-6">
        {/* Header + summary */}
        <div className="flex items-end justify-between px-1">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-violet-500" />
              Token Usage
            </h2>
            <p className="text-muted-foreground font-medium pl-1">
              Consumption per execution
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-500/10 px-4 py-2 text-center">
              <p className="text-xl font-bold text-violet-600">{(data?.totalTokensSum ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">total tokens</p>
            </div>
            <Badge variant="secondary" className="font-mono px-3 py-1 text-sm bg-violet-500/10 text-violet-600 border-none shadow-none">
              {total} executions
            </Badge>
          </div>
        </div>

        {/* Table */}
        <Card className="overflow-hidden border-none shadow-2xl bg-card/60 backdrop-blur-md">
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground font-medium">No executions recorded yet</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Run an agent to start tracking token usage</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6">Date</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agent</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Model</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Input</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Output</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Total</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center pr-6">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="border-border/20 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setSelected(row)}
                    >
                      <TableCell className="pl-6 text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(row.timestamp).toLocaleString(undefined, {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="font-medium text-sm max-w-[140px] truncate">
                        {row.agentName ?? row.agentId.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {row.model.length > 22 ? row.model.slice(0, 22) + '…' : row.model}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{row.inputTokens.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{row.outputTokens.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-violet-600">
                        {row.totalTokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center pr-6">
                        {row.success
                          ? <CheckCircle className="h-4 w-4 text-emerald-500 inline" />
                          : <XCircle className="h-4 w-4 text-destructive inline" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Rows per page:
              <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <TokenUsageDetailModal record={selected} onClose={() => setSelected(null)} />
    </>
  );
}
