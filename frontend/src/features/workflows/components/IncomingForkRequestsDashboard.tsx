'use client';

import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitFork, Check, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useAuthStore } from '@/store/auth.store';
import { listIncomingForkRequests, respondToForkRequest } from '../api/workflow-sharing.api';
import type { WorkflowForkRequest } from '@/types';

export function IncomingForkRequestsDashboard() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['fork-requests-incoming', user?.id],
    queryFn: () => listIncomingForkRequests(user!.id),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const respondMutation = useMutation({
    mutationFn: ({ request, decision }: { request: WorkflowForkRequest; decision: 'APPROVED' | 'REJECTED' }) =>
      respondToForkRequest(request.workflowId, request.id, user!.id, decision),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fork-requests-incoming', user?.id] }),
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GitFork className="h-5 w-5" />
        <h2 className="text-xl font-semibold">{t('forkRequests.title')}</h2>
        {requests.length > 0 && (
          <Badge variant="secondary">{requests.length}</Badge>
        )}
      </div>

      {requests.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">{t('forkRequests.empty')}</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <ForkRequestRow
              key={r.id}
              request={r}
              onRespond={(decision) => respondMutation.mutate({ request: r, decision })}
              isPending={respondMutation.isPending}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface RowProps {
  request: WorkflowForkRequest;
  onRespond: (decision: 'APPROVED' | 'REJECTED') => void;
  isPending: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function ForkRequestRow({ request, onRespond, isPending, t }: RowProps) {
  const requesterName = request.requester
    ? `${request.requester.firstName} ${request.requester.lastName}`.trim() || request.requester.email
    : request.requesterId;
  const requesterEmail = request.requester?.email;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-sm font-medium">
                {t('forkRequests.workflowLabel', { name: request.workflow?.name ?? request.workflowId })}
              </CardTitle>
              {request.type === 'view' ? (
                <Badge variant="secondary" className="gap-1 text-xs font-normal">
                  <Eye className="h-3 w-3" />
                  {t('forkRequests.viewRequest')}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-xs font-normal">
                  <GitFork className="h-3 w-3" />
                  {t('forkRequests.forkRequest')}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{requesterName}</p>
            {requesterEmail && requesterEmail !== requesterName && (
              <p className="text-xs text-muted-foreground">{requesterEmail}</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground shrink-0">
            {new Date(request.createdAt).toLocaleDateString()}
          </p>
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        {request.message ? (
          <p className="text-sm italic text-muted-foreground line-clamp-2">&ldquo;{request.message}&rdquo;</p>
        ) : (
          <span />
        )}
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="text-green-600 border-green-300 hover:bg-green-50 gap-1.5"
            onClick={() => onRespond('APPROVED')}
            disabled={isPending}
          >
            <Check className="h-3.5 w-3.5" />
            {t('forkRequests.approve')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/5 gap-1.5"
            onClick={() => onRespond('REJECTED')}
            disabled={isPending}
          >
            <X className="h-3.5 w-3.5" />
            {t('forkRequests.reject')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
