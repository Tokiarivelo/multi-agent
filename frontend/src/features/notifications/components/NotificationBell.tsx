'use client';

import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/store/auth.store';
import type { AppNotification, WorkflowInvitation } from '@/types';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api/notifications.api';
import {
  listPendingInvitations,
  acceptInvitation,
  declineInvitation,
  respondToForkRequest,
} from '@/features/workflows/api/workflow-sharing.api';

function notificationMessage(n: AppNotification, t: (k: string, opts?: Record<string, unknown>) => string): string {
  const p = n.payload;
  if (n.type === 'collaborator_added') {
    return t('notifications.collaboratorAdded', { inviter: p.inviterName, workflow: p.workflowName, role: p.role });
  }
  if (n.type === 'fork_request_approved') {
    return t('notifications.forkApproved', { workflow: p.workflowName });
  }
  if (n.type === 'fork_request_rejected') {
    return t('notifications.forkRejected', { workflow: p.workflowName });
  }
  if (n.type === 'workflow_request_received') {
    const key = p.requestType === 'view' ? 'notifications.viewRequestReceived' : 'notifications.forkRequestReceived';
    return t(key, { requester: p.requesterName, workflow: p.workflowName });
  }
  return t('notifications.generic');
}

export function NotificationBell() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => getNotifications(user!.id),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const { data: invitations = [] } = useQuery<WorkflowInvitation[]>({
    queryKey: ['pending-invitations-bell', user?.id],
    queryFn: () => listPendingInvitations(user!.id),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const unreadNotifications = notifications.filter((n) => !n.read).length;
  const unreadCount = unreadNotifications + invitations.length;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id, user!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(user!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] }),
  });

  const acceptMutation = useMutation({
    mutationFn: ({ token }: { token: string; invId: string }) =>
      acceptInvitation(token, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invitations-bell', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['pending-invitations', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: ({ token, email }: { token: string; email: string; invId: string }) =>
      declineInvitation(token, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invitations-bell', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['pending-invitations', user?.id] });
    },
  });

  const respondRequestMutation = useMutation({
    mutationFn: ({ workflowId, requestId, decision }: { workflowId: string; requestId: string; decision: 'APPROVED' | 'REJECTED'; notifId: string }) =>
      respondToForkRequest(workflowId, requestId, user!.id, decision),
    onSuccess: (_, { notifId }) => {
      markReadMutation.mutate(notifId);
      queryClient.invalidateQueries({ queryKey: ['fork-requests-incoming', user?.id] });
    },
  });

  const isEmpty = invitations.length === 0 && notifications.length === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">
            {t('notifications.title')}
          </DropdownMenuLabel>
          {unreadNotifications > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => { e.preventDefault(); markAllReadMutation.mutate(); }}
              disabled={markAllReadMutation.isPending}
            >
              {t('notifications.markAllRead')}
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {isEmpty ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('notifications.empty')}
            </p>
          ) : (
            <>
              {/* Pending invitations — always unread, shown first */}
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col gap-2 px-4 py-3 bg-primary/5 border-b last:border-0"
                >
                  <p className="text-xs leading-snug">
                    {t('notifications.invitationReceived', {
                      workflow: inv.workflow?.name ?? inv.workflowId,
                      role: inv.role,
                    })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs px-2 text-green-600 border-green-300 hover:bg-green-50"
                      onClick={(e) => {
                        e.preventDefault();
                        acceptMutation.mutate({ token: inv.token, invId: inv.id });
                      }}
                      disabled={acceptMutation.isPending && acceptMutation.variables?.invId === inv.id}
                    >
                      {t('notifications.acceptInvite')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs px-2 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        declineMutation.mutate({ token: inv.token, email: inv.email, invId: inv.id });
                      }}
                      disabled={declineMutation.isPending && declineMutation.variables?.invId === inv.id}
                    >
                      {t('notifications.declineInvite')}
                    </Button>
                  </div>
                </div>
              ))}

              {/* Notifications — actionable request ones get approve/reject buttons */}
              {notifications.map((n) => {
                const p = n.payload;
                const isRequest = n.type === 'workflow_request_received' && !n.read;
                if (isRequest) {
                  return (
                    <div
                      key={n.id}
                      className="flex flex-col gap-2 px-4 py-3 bg-primary/5 border-b last:border-0"
                    >
                      <p className="text-xs leading-snug">{notificationMessage(n, t)}</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs px-2 text-green-600 border-green-300 hover:bg-green-50"
                          onClick={(e) => {
                            e.preventDefault();
                            respondRequestMutation.mutate({
                              workflowId: p.workflowId as string,
                              requestId: p.requestId as string,
                              decision: 'APPROVED',
                              notifId: n.id,
                            });
                          }}
                          disabled={respondRequestMutation.isPending && respondRequestMutation.variables?.notifId === n.id}
                        >
                          {t('notifications.approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs px-2 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.preventDefault();
                            respondRequestMutation.mutate({
                              workflowId: p.workflowId as string,
                              requestId: p.requestId as string,
                              decision: 'REJECTED',
                              notifId: n.id,
                            });
                          }}
                          disabled={respondRequestMutation.isPending && respondRequestMutation.variables?.notifId === n.id}
                        >
                          {t('notifications.reject')}
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <DropdownMenuItem
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer ${!n.read ? 'bg-primary/5' : ''}`}
                    onClick={() => !n.read && markReadMutation.mutate(n.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-snug whitespace-normal">{notificationMessage(n, t)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
