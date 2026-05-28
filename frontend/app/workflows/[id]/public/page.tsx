'use client';

import { use, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Globe, Lock, GitFork, Eye } from 'lucide-react';
import { AxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/store/auth.store';
import { workflowsApi } from '@/features/workflows/api/workflows.api';
import {
  listPublicWorkflows,
  requestFork,
  requestView,
} from '@/features/workflows/api/workflow-sharing.api';

export default function WorkflowSharedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const [showForkDialog, setShowForkDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [forkMessage, setForkMessage] = useState('');
  const [viewMessage, setViewMessage] = useState('');

  // Attempt to fetch with the user's credentials — succeeds if owner or collaborator
  const { data: workflow, isLoading, isError, error } = useQuery({
    queryKey: ['workflow-shared', id],
    queryFn: () => workflowsApi.getById(id),
    retry: false,
    enabled: !!user,
  });

  const isForbidden =
    isError && (error instanceof AxiosError) && error.response?.status === 403;

  // If access is denied, fetch the public listing to show name/description
  const { data: publicInfo } = useQuery({
    queryKey: ['public-workflow-info', id],
    queryFn: async () => {
      const result = await listPublicWorkflows(1, 100);
      return result.data.find((w) => w.id === id) ?? null;
    },
    enabled: isForbidden,
  });

  const requestForkMutation = useMutation({
    mutationFn: () => requestFork(id, user!.id, forkMessage || undefined),
    onSuccess: () => { setShowForkDialog(false); setForkMessage(''); },
  });

  const requestViewMutation = useMutation({
    mutationFn: () => requestView(id, user!.id, viewMessage || undefined),
    onSuccess: () => { setShowViewDialog(false); setViewMessage(''); },
  });

  if (!user || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/10">
        <div className="space-y-3 w-64">
          <div className="h-8 rounded bg-muted animate-pulse mx-auto w-48" />
          <div className="h-4 rounded bg-muted animate-pulse" />
          <div className="h-4 rounded bg-muted animate-pulse w-3/4 mx-auto" />
        </div>
      </div>
    );
  }

  // ── Access denied ──────────────────────────────────────────────────────────
  if (isForbidden) {
    const name = publicInfo?.name;
    const description = publicInfo?.description;

    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/10 p-8">
        <div className="max-w-md w-full rounded-xl border bg-card shadow-sm p-8 text-center space-y-5">
          <div className="flex justify-center">
            <div className="rounded-full bg-destructive/10 p-4">
              <Lock className="h-8 w-8 text-destructive" />
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight">
              {name ?? t('sharing.publicPage.workflow')}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">{t('sharing.publicPage.noAccess')}</p>
            <p className="text-xs text-muted-foreground">
              {t('sharing.publicPage.noAccessDescription')}
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 gap-1.5"
              onClick={() => setShowViewDialog(true)}
            >
              <Eye className="h-4 w-4" />
              {t('sharing.public.requestView')}
            </Button>
            <Button
              className="flex-1 gap-1.5"
              onClick={() => setShowForkDialog(true)}
            >
              <GitFork className="h-4 w-4" />
              {t('sharing.public.requestFork')}
            </Button>
          </div>
        </div>

        {/* Request to view dialog */}
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t('sharing.public.viewRequestModal.title', { name: name ?? '' })}
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
              <Button variant="outline" onClick={() => setShowViewDialog(false)}>
                {t('sharing.public.forkModal.cancel')}
              </Button>
              <Button
                onClick={() => requestViewMutation.mutate()}
                disabled={requestViewMutation.isPending}
              >
                <Eye className="mr-1.5 h-4 w-4" />
                {t('sharing.public.viewRequestModal.send')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Request to fork dialog */}
        <Dialog open={showForkDialog} onOpenChange={setShowForkDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t('sharing.public.forkRequestModal.title', { name: name ?? '' })}
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
              <Button variant="outline" onClick={() => setShowForkDialog(false)}>
                {t('sharing.public.forkModal.cancel')}
              </Button>
              <Button
                onClick={() => requestForkMutation.mutate()}
                disabled={requestForkMutation.isPending}
              >
                <GitFork className="mr-1.5 h-4 w-4" />
                {t('sharing.public.forkRequestModal.send')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Access granted ─────────────────────────────────────────────────────────
  if (workflow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/10 p-8">
        <div className="max-w-md w-full rounded-xl border bg-card shadow-sm p-8 text-center space-y-5">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Globe className="h-8 w-8 text-primary" />
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight">{workflow.name}</h1>
            {workflow.description && (
              <p className="text-sm text-muted-foreground">{workflow.description}</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">{t('sharing.publicPage.hasAccess')}</p>

          <Link
            href={`/workflows/${id}`}
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            {t('sharing.publicPage.openWorkflow')}
          </Link>
        </div>
      </div>
    );
  }

  // ── Generic error (network, 404, etc.) ─────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/10 p-8">
      <div className="max-w-md w-full rounded-xl border bg-card shadow-sm p-8 text-center space-y-4">
        <Lock className="h-10 w-10 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('sharing.publicPage.notFound')}</p>
      </div>
    </div>
  );
}
