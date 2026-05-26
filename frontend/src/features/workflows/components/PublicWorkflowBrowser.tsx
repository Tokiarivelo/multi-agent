'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Globe, GitFork, Clock, Eye } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  listPublicWorkflows,
  forkWorkflow,
  requestFork,
  requestView,
} from '../api/workflow-sharing.api';
import type { Workflow } from '@/types';

export function PublicWorkflowBrowser() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [forkRequestModal, setForkRequestModal] = useState<Workflow | null>(null);
  const [viewRequestModal, setViewRequestModal] = useState<Workflow | null>(null);
  const [forkDirectModal, setForkDirectModal] = useState<Workflow | null>(null);
  const [forkMessage, setForkMessage] = useState('');
  const [viewMessage, setViewMessage] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['public-workflows', page],
    queryFn: () => listPublicWorkflows(page),
    enabled: !!user,
  });

  const requestForkMutation = useMutation({
    mutationFn: () => requestFork(forkRequestModal!.id, user!.id, forkMessage || undefined),
    onSuccess: () => {
      setForkRequestModal(null);
      setForkMessage('');
      queryClient.invalidateQueries({ queryKey: ['public-workflows'] });
    },
  });

  const requestViewMutation = useMutation({
    mutationFn: () => requestView(viewRequestModal!.id, user!.id, viewMessage || undefined),
    onSuccess: () => {
      setViewRequestModal(null);
      setViewMessage('');
      queryClient.invalidateQueries({ queryKey: ['public-workflows'] });
    },
  });

  const forkMutation = useMutation({
    mutationFn: () => forkWorkflow(forkDirectModal!.id, user!.id),
    onSuccess: () => {
      setForkDirectModal(null);
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  const workflows = data?.data ?? [];
  const total = data?.total ?? 0;

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Globe className="h-5 w-5" />
        <h2 className="text-xl font-semibold">{t('sharing.public.title')}</h2>
        <Badge variant="secondary">{total}</Badge>
      </div>

      {workflows.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">{t('sharing.public.empty')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workflows.map((wf) => (
            <PublicWorkflowCard
              key={wf.id}
              workflow={wf}
              currentUserId={user?.id}
              onRequestFork={() => setForkRequestModal(wf)}
              onRequestView={() => setViewRequestModal(wf)}
              onForkDirect={() => setForkDirectModal(wf)}
              t={t}
            />
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            {t('sharing.public.prev')}
          </Button>
          <span className="self-center text-sm text-muted-foreground">
            {t('sharing.public.page', { page, total: Math.ceil(total / 20) })}
          </span>
          <Button size="sm" variant="outline" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>
            {t('sharing.public.next')}
          </Button>
        </div>
      )}

      {/* ─── Request to Fork dialog ────────────────────────────────── */}
      <Dialog open={!!forkRequestModal} onOpenChange={(v) => !v && setForkRequestModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('sharing.public.forkRequestModal.title', { name: forkRequestModal?.name })}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('sharing.public.forkRequestModal.description')}
          </p>
          <Textarea
            placeholder={t('sharing.public.forkRequestModal.messagePlaceholder')}
            value={forkMessage}
            onChange={(e) => setForkMessage(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setForkRequestModal(null)}>
              {t('sharing.public.forkModal.cancel')}
            </Button>
            <Button onClick={() => requestForkMutation.mutate()} disabled={requestForkMutation.isPending}>
              <GitFork className="mr-1.5 h-4 w-4" />
              {t('sharing.public.forkRequestModal.send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Request to View dialog ───────────────────────────────── */}
      <Dialog open={!!viewRequestModal} onOpenChange={(v) => !v && setViewRequestModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('sharing.public.viewRequestModal.title', { name: viewRequestModal?.name })}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('sharing.public.viewRequestModal.description')}
          </p>
          <Textarea
            placeholder={t('sharing.public.viewRequestModal.messagePlaceholder')}
            value={viewMessage}
            onChange={(e) => setViewMessage(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewRequestModal(null)}>
              {t('sharing.public.forkModal.cancel')}
            </Button>
            <Button onClick={() => requestViewMutation.mutate()} disabled={requestViewMutation.isPending}>
              <Eye className="mr-1.5 h-4 w-4" />
              {t('sharing.public.viewRequestModal.send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Direct fork confirmation dialog (collaborators) ─────── */}
      <Dialog open={!!forkDirectModal} onOpenChange={(v) => !v && setForkDirectModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('sharing.public.forkModal.title', { name: forkDirectModal?.name })}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('sharing.public.forkModal.description')}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForkDirectModal(null)}>
              {t('sharing.public.forkModal.cancel')}
            </Button>
            <Button onClick={() => forkMutation.mutate()} disabled={forkMutation.isPending}>
              <GitFork className="mr-1.5 h-4 w-4" />
              {t('sharing.public.forkModal.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CardProps {
  workflow: Workflow;
  currentUserId?: string;
  onRequestFork: () => void;
  onRequestView: () => void;
  onForkDirect: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function PublicWorkflowCard({ workflow, currentUserId, onRequestFork, onRequestView, onForkDirect, t }: CardProps) {
  const isOwner = workflow.userId === currentUserId;
  const isCollaborator = !isOwner && (workflow.collaborators ?? []).some(
    (c) => c.userId === currentUserId,
  );
  const canForkDirect = isOwner || isCollaborator;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base line-clamp-1">{workflow.name}</CardTitle>
          {isOwner && (
            <Badge variant="secondary" className="shrink-0 text-xs">{t('workflows.owner')}</Badge>
          )}
        </div>
        {workflow.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{workflow.description}</p>
        )}
      </CardHeader>
      <CardContent className="flex gap-2">
        {!isOwner && (
          canForkDirect ? (
            <Button size="sm" variant="outline" className="flex-1" onClick={onForkDirect}>
              <GitFork className="mr-1.5 h-3.5 w-3.5" />
              {t('sharing.public.fork')}
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" className="flex-1" onClick={onRequestView}>
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                {t('sharing.public.requestView')}
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={onRequestFork}>
                <Clock className="mr-1.5 h-3.5 w-3.5" />
                {t('sharing.public.requestFork')}
              </Button>
            </>
          )
        )}
      </CardContent>
    </Card>
  );
}
