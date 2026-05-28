'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { WorkflowForkRequest } from '@/types';

interface Props {
  requests: WorkflowForkRequest[];
  onRespond: (id: string, decision: 'APPROVED' | 'REJECTED') => void;
  isPending: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

export function ForkRequestList({ requests, onRespond, isPending, t }: Props) {
  const pending = requests.filter((r) => r.status === 'PENDING');
  if (pending.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('sharing.forkRequests.title')}
        </p>
        <Badge className="h-5 px-1.5 text-xs">{pending.length}</Badge>
      </div>
      <div className="space-y-2">
        {pending.map((r) => {
          const name = r.requester
            ? `${r.requester.firstName} ${r.requester.lastName}`.trim() || r.requester.email
            : r.requesterId;
          return (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg border px-4 py-3 gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{name}</p>
                {r.requester?.email && r.requester.email !== name && (
                  <p className="text-xs text-muted-foreground truncate">{r.requester.email}</p>
                )}
                {r.message && (
                  <p className="text-xs text-muted-foreground mt-0.5 italic">&ldquo;{r.message}&rdquo;</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-600 border-green-300 hover:bg-green-50"
                  onClick={() => onRespond(r.id, 'APPROVED')}
                  disabled={isPending}
                >
                  {t('sharing.forkRequests.approve')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={() => onRespond(r.id, 'REJECTED')}
                  disabled={isPending}
                >
                  {t('sharing.forkRequests.reject')}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
