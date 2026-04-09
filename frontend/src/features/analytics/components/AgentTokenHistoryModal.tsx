'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useTokenUsage } from '../hooks/useTokenUsage';
import {
  BarChart3,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

const PAGE_SIZES = [10, 25, 50];

interface Props {
  agentId: string;
  agentName?: string;
  open: boolean;
  onClose: () => void;
}

export function AgentTokenHistoryModal({ agentId, agentName, open, onClose }: Props) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data, isLoading, error } = useTokenUsage({ agentId, page, limit });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-violet-500" />
            Token History — {agentName ?? agentId.slice(0, 8)}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 mt-1">
          <div className="rounded-lg bg-violet-500/10 px-3 py-1.5 text-center">
            <p className="text-base font-bold text-violet-600">{(data?.totalTokensSum ?? 0).toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">total tokens</p>
          </div>
          <Badge variant="secondary" className="font-mono text-xs bg-violet-500/10 text-violet-600 border-none">
            {total} executions
          </Badge>
        </div>

        <div className="flex-1 overflow-auto mt-3">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner className="h-8 w-8 text-violet-500" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center py-12 text-destructive">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p className="text-sm font-medium">Failed to load history</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <BarChart3 className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No executions recorded yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Model</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Input</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Output</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Total</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className="border-border/20">
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(row.timestamp).toLocaleString(undefined, {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {row.model.length > 20 ? row.model.slice(0, 20) + '…' : row.model}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{row.inputTokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{row.outputTokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold text-violet-600">
                      {row.totalTokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.success
                        ? <CheckCircle className="h-4 w-4 text-emerald-500 inline" />
                        : <XCircle className="h-4 w-4 text-destructive inline" />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between pt-3 border-t border-border/40">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Rows:
              <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-16 h-7">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
