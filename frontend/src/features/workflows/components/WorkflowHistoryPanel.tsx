'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { History, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { getWorkflowHistory } from '../api/workflow-sharing.api';
import type { WorkflowChangeLog } from '@/types';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
const ACTION_COLORS: Record<string, BadgeVariant> = {
  CREATED: 'default',
  NODE_ADDED: 'secondary',
  NODE_UPDATED: 'outline',
  NODE_REMOVED: 'destructive',
  EDGE_ADDED: 'secondary',
  EDGE_REMOVED: 'destructive',
  STATUS_CHANGED: 'outline',
  VISIBILITY_CHANGED: 'default',
  SETTINGS_UPDATED: 'outline',
  FORKED: 'default',
};

interface Props {
  workflowId: string;
}

export function WorkflowHistoryPanel({ workflowId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['workflow-history', workflowId, page],
    queryFn: () => getWorkflowHistory(workflowId, user!.id, page, 30),
    enabled: !!user,
  });

  const logs: WorkflowChangeLog[] = data?.data ?? [];
  const total = data?.total ?? 0;

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4" />
        <h3 className="font-semibold">{t('sharing.history.title')}</h3>
        <Badge variant="secondary">{total}</Badge>
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('sharing.history.empty')}</p>
      ) : (
        <div className="relative border-l-2 border-muted pl-4 space-y-4">
          {logs.map((log) => (
            <div key={log.id} className="relative">
              <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={ACTION_COLORS[log.action] ?? 'secondary'} className="text-xs">
                    {t(`sharing.history.actions.${log.action.toLowerCase()}`, { defaultValue: log.action })}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                  <button
                    className="ml-auto"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    {expandedId === log.id ? (
                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                </div>
                {expandedId === log.id && (
                  <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-32">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 30 && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('sharing.history.prev')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page * 30 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('sharing.history.next')}
          </Button>
        </div>
      )}
    </div>
  );
}
