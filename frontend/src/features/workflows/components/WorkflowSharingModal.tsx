'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Globe, Lock, Users, UserPlus, Check } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import type { CollaboratorRole, WorkflowAccessRequest, WorkflowCollaborator, WorkflowVisibility } from '@/types';
import {
  listCollaborators,
  inviteCollaborator,
  updateCollaboratorRole,
  removeCollaborator,
  setWorkflowVisibility,
  listAccessRequests,
  respondToAccessRequest,
} from '../api/workflow-sharing.api';
import { CollaboratorList } from './CollaboratorList';

interface Props {
  workflowId: string;
  workflowName: string;
  currentVisibility: WorkflowVisibility;
  open: boolean;
  onClose: () => void;
}

const VISIBILITY_OPTIONS: {
  value: WorkflowVisibility;
  Icon: React.ElementType;
  labelKey: string;
  descKey: string;
}[] = [
  { value: 'PRIVATE', Icon: Lock, labelKey: 'sharing.visibility.private', descKey: 'sharing.visibility.privateDesc' },
  { value: 'SHARED', Icon: Users, labelKey: 'sharing.visibility.shared', descKey: 'sharing.visibility.sharedDesc' },
  { value: 'PUBLIC', Icon: Globe, labelKey: 'sharing.visibility.public', descKey: 'sharing.visibility.publicDesc' },
];

export function WorkflowSharingModal({
  workflowId,
  workflowName,
  currentVisibility,
  open,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [visibility, setVisibility] = useState<WorkflowVisibility>(currentVisibility);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CollaboratorRole>('EDITOR');
  const [inviteError, setInviteError] = useState('');

  const { data: collaborators = [] } = useQuery({
    queryKey: ['workflow-collaborators', workflowId],
    queryFn: () => listCollaborators(workflowId, user!.id),
    enabled: open && !!user,
  });

  const { data: accessRequests = [] } = useQuery({
    queryKey: ['workflow-access-requests', workflowId],
    queryFn: () => listAccessRequests(workflowId, user!.id),
    enabled: open && !!user && visibility === 'PUBLIC',
  });

  const setVisibilityMutation = useMutation({
    mutationFn: (v: WorkflowVisibility) => setWorkflowVisibility(workflowId, user!.id, v),
    onSuccess: (_, v) => {
      setVisibility(v);
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: () => inviteCollaborator(workflowId, user!.id, inviteEmail, inviteRole),
    onSuccess: () => {
      setInviteEmail('');
      setInviteError('');
      queryClient.invalidateQueries({ queryKey: ['workflow-collaborators', workflowId] });
    },
    onError: (err: unknown) => setInviteError((err as Error)?.message ?? t('sharing.error.inviteFailed')),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: CollaboratorRole }) =>
      updateCollaboratorRole(workflowId, id, user!.id, role),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['workflow-collaborators', workflowId] }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeCollaborator(workflowId, id, user!.id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['workflow-collaborators', workflowId] }),
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'DENIED' }) =>
      respondToAccessRequest(workflowId, id, user!.id, decision),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['workflow-access-requests', workflowId] }),
  });

  const pendingRequests = (accessRequests as WorkflowAccessRequest[]).filter((r) => r.status === 'PENDING');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('sharing.title', { name: workflowName })}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* ─── Visibility zone ───────────────────────────────────────────── */}
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('sharing.visibility.label')}
            </p>
            <div className="rounded-lg border divide-y overflow-hidden">
              {VISIBILITY_OPTIONS.map(({ value, Icon, labelKey, descKey }) => {
                const active = visibility === value;
                return (
                  <button
                    key={value}
                    onClick={() => setVisibilityMutation.mutate(value)}
                    disabled={setVisibilityMutation.isPending}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      active ? 'bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${active ? 'text-primary' : ''}`}>
                        {t(labelKey)}
                      </p>
                      <p className="text-xs text-muted-foreground">{t(descKey)}</p>
                    </div>
                    {active && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ─── Collaborators section ─────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('sharing.tabs.collaborators')}
            </p>

            {/* Invite row */}
            <div className="flex gap-2">
              <Input
                placeholder={t('sharing.invite.emailPlaceholder')}
                value={inviteEmail}
                onChange={(e) => { setInviteEmail(e.target.value); setInviteError(''); }}
                type="email"
                className="flex-1"
              />
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as CollaboratorRole)}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEWER">{t('sharing.roles.viewer')}</SelectItem>
                  <SelectItem value="EXECUTOR">{t('sharing.roles.executor')}</SelectItem>
                  <SelectItem value="EDITOR">{t('sharing.roles.editor')}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => inviteMutation.mutate()}
                disabled={!inviteEmail || inviteMutation.isPending}
                className="gap-1"
              >
                <UserPlus className="h-4 w-4" />
                {t('sharing.invite.button')}
              </Button>
            </div>
            {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}

            {/* Collaborator list */}
            <CollaboratorList
              collaborators={collaborators as WorkflowCollaborator[]}
              onUpdateRole={(id, role) => updateRoleMutation.mutate({ id, role })}
              onRemove={(id) => removeMutation.mutate(id)}
              t={t}
            />
          </section>

          {/* ─── Access requests (PUBLIC only) ─────────────────────────────── */}
          {visibility === 'PUBLIC' && pendingRequests.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('sharing.tabs.requests')}
                </p>
                <Badge className="h-5 px-1.5 text-xs">{pendingRequests.length}</Badge>
              </div>
              <div className="space-y-2">
                {pendingRequests.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{r.requesterId}</p>
                      {r.message && (
                        <p className="text-xs text-muted-foreground">&ldquo;{r.message}&rdquo;</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-300 hover:bg-green-50"
                        onClick={() => respondMutation.mutate({ id: r.id, decision: 'APPROVED' })}
                      >
                        {t('sharing.requests.approve')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={() => respondMutation.mutate({ id: r.id, decision: 'DENIED' })}
                      >
                        {t('sharing.requests.deny')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}

