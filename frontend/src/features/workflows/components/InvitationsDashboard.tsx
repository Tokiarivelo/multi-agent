'use client';

import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Mail, CheckCircle, XCircle } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { listPendingInvitations, acceptInvitation, declineInvitation } from '../api/workflow-sharing.api';
import type { WorkflowInvitation } from '@/types';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
const ROLE_COLORS: Record<string, BadgeVariant> = {
  VIEWER: 'secondary',
  EXECUTOR: 'outline',
  EDITOR: 'default',
};

export function InvitationsDashboard() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ['pending-invitations', user?.id],
    queryFn: () => listPendingInvitations(user!.id),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const acceptMutation = useMutation({
    mutationFn: (token: string) => acceptInvitation(token, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (token: string) => declineInvitation(token, user!.email ?? ''),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pending-invitations'] }),
  });

  if (isLoading) return <LoadingSpinner />;

  const list = invitations as WorkflowInvitation[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5" />
        <h2 className="text-xl font-semibold">{t('sharing.invitations.title')}</h2>
        {list.length > 0 && <Badge>{list.length}</Badge>}
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t('sharing.invitations.empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((inv) => (
            <Card key={inv.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {inv.workflow?.name ?? inv.workflowId}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('sharing.invitations.invitedBy', {
                        name: inv.inviter
                          ? `${inv.inviter.firstName} ${inv.inviter.lastName}`
                          : inv.invitedBy,
                      })}
                    </p>
                    {inv.workflow?.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {inv.workflow.description}
                      </p>
                    )}
                  </div>
                  <Badge variant={ROLE_COLORS[inv.role] ?? 'secondary'}>
                    {t(`sharing.roles.${inv.role.toLowerCase()}`)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex gap-2 pt-0">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => acceptMutation.mutate(inv.token)}
                  disabled={acceptMutation.isPending}
                >
                  <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                  {t('sharing.invitations.accept')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => declineMutation.mutate(inv.token)}
                  disabled={declineMutation.isPending}
                >
                  <XCircle className="mr-1.5 h-3.5 w-3.5" />
                  {t('sharing.invitations.decline')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
