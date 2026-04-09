'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TokenUsageRecord } from '../api/analytics.api';
import { CheckCircle, XCircle, Hash, Calendar, Bot, Cpu } from 'lucide-react';

interface Props {
  record: TokenUsageRecord | null;
  onClose: () => void;
}

export function TokenUsageDetailModal({ record, onClose }: Props) {
  if (!record) return null;

  return (
    <Dialog open={!!record} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Hash className="h-5 w-5 text-violet-500" />
            Execution Detail
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Meta row */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {new Date(record.timestamp).toLocaleString()}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Bot className="h-4 w-4" />
              {record.agentName ?? record.agentId.slice(0, 8)}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Cpu className="h-4 w-4" />
              {record.model}
            </div>
            <div className="flex items-center gap-2">
              {record.success ? (
                <><CheckCircle className="h-4 w-4 text-emerald-500" /><span className="text-emerald-600 font-medium">Success</span></>
              ) : (
                <><XCircle className="h-4 w-4 text-destructive" /><span className="text-destructive font-medium">Failed</span></>
              )}
            </div>
          </div>

          {/* Token counts */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-xl bg-muted/40 p-3 text-center">
              <p className="text-2xl font-bold text-violet-500">{record.totalTokens.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Total tokens</p>
            </div>
            <div className="flex-1 rounded-xl bg-muted/40 p-3 text-center">
              <p className="text-2xl font-bold">{record.inputTokens.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Input tokens</p>
            </div>
            <div className="flex-1 rounded-xl bg-muted/40 p-3 text-center">
              <p className="text-2xl font-bold">{record.outputTokens.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Output tokens</p>
            </div>
          </div>

          {/* Input preview */}
          {record.inputPreview && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Input</p>
              <pre className="whitespace-pre-wrap break-words text-sm bg-muted/30 rounded-xl p-3 max-h-40 overflow-y-auto font-mono leading-relaxed">
                {record.inputPreview}
              </pre>
            </div>
          )}

          {/* Output preview */}
          {record.outputPreview && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Output</p>
              <pre className="whitespace-pre-wrap break-words text-sm bg-muted/30 rounded-xl p-3 max-h-40 overflow-y-auto font-mono leading-relaxed">
                {record.outputPreview}
              </pre>
            </div>
          )}

          {/* Error */}
          {record.errorMessage && (
            <div>
              <p className="text-xs font-semibold text-destructive uppercase tracking-wider mb-1.5">Error</p>
              <p className="text-sm text-destructive bg-destructive/10 rounded-xl p-3">{record.errorMessage}</p>
            </div>
          )}

          {/* IDs */}
          <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t">
            <p>Execution ID: <span className="font-mono">{record.executionId ?? '—'}</span></p>
            <p>Agent ID: <span className="font-mono">{record.agentId}</span></p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
