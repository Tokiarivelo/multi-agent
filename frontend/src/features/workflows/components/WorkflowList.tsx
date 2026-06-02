'use client';

import { useWorkflows, useDeleteWorkflow } from '../hooks/useWorkflows';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { marketplaceApi } from '@/features/marketplace/api/marketplace.api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Play, Edit, Trash2, Share2, Crown, Users, GitFork, Upload } from 'lucide-react';
import Link from 'next/link';
import { formatRelativeTime, getStatusColor } from '@/lib/utils';
import { useState } from 'react';
import { CreateWorkflowModal } from './CreateWorkflowModal';
import { DeleteGuardDialog } from '@/components/shared/DeleteGuardDialog';
import { useDeleteGuard } from '@/hooks/useDeleteGuard';
import { WorkflowSharingModal } from './WorkflowSharingModal';
import { PublishToMarketplaceModal } from '@/features/marketplace/components/PublishToMarketplaceModal';
import { AvatarGroup } from './AvatarGroup';
import { Workflow, WorkflowForkedFrom, WorkflowVisibility } from '@/types';
import { useAuthStore } from '@/store/auth.store';

interface ShareTarget {
  workflowId: string;
  workflowName: string;
  visibility: WorkflowVisibility;
  forkedFrom?: WorkflowForkedFrom;
}

export function WorkflowList() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useWorkflows();
  const deleteWorkflow = useDeleteWorkflow();
  const deleteGuard = useDeleteGuard('workflow');
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingDeleteWorkflow, setPendingDeleteWorkflow] = useState<Workflow | null>(null);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [publishTarget, setPublishTarget] = useState<Workflow | null>(null);

  const unpublishMutation = useMutation({
    mutationFn: (workflowId: string) => marketplaceApi.unpublish(workflowId, user!.id),
    onSuccess: () => {
      toast.success(t('marketplace.unpublish.success'));
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    },
    onError: () => toast.error(t('marketplace.unpublish.error')),
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-destructive">Error loading workflows</div>;

  const workflows = data?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('workflows.title')}</h2>
          <p className="text-muted-foreground">{t('workflows.subtitle')}</p>
        </div>
        <Button className="gap-2" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          {t('workflows.new')}
        </Button>
        <CreateWorkflowModal open={modalOpen} onOpenChange={setModalOpen} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('workflows.all')}</CardTitle>
          <CardDescription>
            {workflows.length} {t('workflows.total')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workflows.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t('workflows.empty.title')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('workflows.table.name')}</TableHead>
                  <TableHead>{t('workflows.table.description')}</TableHead>
                  <TableHead>{t('workflows.table.status')}</TableHead>
                  <TableHead>{t('workflows.table.nodes')}</TableHead>
                  <TableHead>{t('workflows.table.collaborators')}</TableHead>
                  <TableHead>{t('workflows.table.updated')}</TableHead>
                  <TableHead>{t('workflows.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map((workflow) => (
                  <WorkflowRow
                    key={workflow.id}
                    workflow={workflow}
                    currentUserId={user?.id}
                    onShare={(w) =>
                      setShareTarget({
                        workflowId: w.id,
                        workflowName: w.name,
                        visibility: w.visibility ?? 'PRIVATE',
                        forkedFrom: w.forkedFrom,
                      })
                    }
                    onDelete={(w) => {
                      setPendingDeleteWorkflow(w);
                      deleteGuard.openGuard(w.id);
                    }}
                    onPublish={(w) => setPublishTarget(w)}
                    onUnpublish={(w) => unpublishMutation.mutate(w.id)}
                    unpublishDisabled={unpublishMutation.isPending}
                    deleteDisabled={deleteWorkflow.isPending}
                    t={t}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DeleteGuardDialog
        open={deleteGuard.open}
        onOpenChange={(open) => {
          if (!open) {
            deleteGuard.close();
            setPendingDeleteWorkflow(null);
          }
        }}
        entityName={pendingDeleteWorkflow?.name ?? ''}
        entityType={t('deleteGuard.types.workflow')}
        dependencies={deleteGuard.dependencies}
        isChecking={deleteGuard.isChecking}
        isDeleting={deleteWorkflow.isPending}
        onConfirm={() => {
          if (!pendingDeleteWorkflow) return;
          deleteWorkflow.mutate(pendingDeleteWorkflow.id, {
            onSuccess: () => {
              deleteGuard.close();
              setPendingDeleteWorkflow(null);
            },
          });
        }}
      />

      {publishTarget && user?.id && (
        <PublishToMarketplaceModal
          open={!!publishTarget}
          onClose={() => setPublishTarget(null)}
          workflowId={publishTarget.id}
          workflowName={publishTarget.name}
          userId={user.id}
          isAdmin={user.role === 'ADMIN'}
          isPublished={!!publishTarget.isTemplate}
          initialValues={{
            name: publishTarget.name,
            category: publishTarget.category ?? undefined,
            tags: publishTarget.tags,
          }}
        />
      )}

      {shareTarget && (
        <WorkflowSharingModal
          workflowId={shareTarget.workflowId}
          workflowName={shareTarget.workflowName}
          currentVisibility={shareTarget.visibility}
          forkedFrom={shareTarget.forkedFrom}
          open={!!shareTarget}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  );
}

interface WorkflowRowProps {
  workflow: Workflow;
  currentUserId?: string;
  onShare: (w: Workflow) => void;
  onDelete: (w: Workflow) => void;
  onPublish: (w: Workflow) => void;
  onUnpublish: (w: Workflow) => void;
  deleteDisabled: boolean;
  unpublishDisabled: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function WorkflowRow({ workflow, currentUserId, onShare, onDelete, onPublish, onUnpublish, deleteDisabled, unpublishDisabled, t }: WorkflowRowProps) {
  const isShared = !!currentUserId && workflow.userId !== currentUserId;
  const collaboratorPeople = (workflow.collaborators ?? []).map((c) => ({
    name: `${c.firstName} ${c.lastName}`.trim() || c.email,
    email: c.email,
  }));

  const ownerLabel = workflow.owner
    ? `${workflow.owner.firstName} ${workflow.owner.lastName}`.trim() || workflow.owner.email
    : undefined;

  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Link href={`/workflows/${workflow.id}`} className="hover:underline">
              {workflow.name}
            </Link>
            {isShared && (
              <Badge variant="secondary" className="gap-1 text-xs font-normal">
                <Users className="h-3 w-3" />
                {t('sharing.sharedBadge')}
              </Badge>
            )}
            {workflow.isTemplate && (
              <Badge variant="success" className="gap-1 text-xs font-normal">
                <Upload className="h-3 w-3" />
                {t('marketplace.badge.published')}
              </Badge>
            )}
          </div>
          {workflow.forkedFromId && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <GitFork className="h-3 w-3 shrink-0" />
              {workflow.forkedFrom
                ? workflow.forkedFrom.owner
                  ? t('workflows.forkedFrom', {
                      name: workflow.forkedFrom.name,
                      owner:
                        `${workflow.forkedFrom.owner.firstName} ${workflow.forkedFrom.owner.lastName}`.trim() ||
                        workflow.forkedFrom.owner.email,
                    })
                  : t('workflows.forkedFromNoOwner', { name: workflow.forkedFrom.name })
                : t('workflows.forkedFromDeleted')}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {workflow.description || '—'}
      </TableCell>
      <TableCell>
        <Badge
          variant={
            getStatusColor(workflow.status) as 'default' | 'success' | 'warning' | 'destructive'
          }
        >
          {workflow.status}
        </Badge>
      </TableCell>
      <TableCell>{workflow.definition?.nodes?.length || 0}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {ownerLabel && (
            <span
              title={ownerLabel}
              className="flex items-center gap-1 text-xs text-muted-foreground"
            >
              <Crown className="h-3 w-3 text-amber-500" />
              <span className="max-w-[80px] truncate">{ownerLabel}</span>
            </span>
          )}
          <AvatarGroup people={collaboratorPeople} max={3} />
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatRelativeTime(workflow.updatedAt)}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Link href={`/workflows/${workflow.id}`}>
            <Button variant="ghost" size="sm" className="gap-1">
              <Edit className="h-3 w-3" />
              {t('workflows.actions.edit')}
            </Button>
          </Link>
          <Button variant="ghost" size="sm" className="gap-1">
            <Play className="h-3 w-3" />
            {t('workflows.actions.run')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => onShare(workflow)}
          >
            <Share2 className="h-3 w-3" />
            {t('workflows.actions.share')}
          </Button>
          {workflow.userId === currentUserId && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() => onPublish(workflow)}
            >
              <Upload className="h-3 w-3" />
              {workflow.isTemplate
                ? t('marketplace.update.submit')
                : t('marketplace.publish.button')}
            </Button>
          )}
          {workflow.isTemplate && workflow.userId === currentUserId && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground hover:text-destructive"
                  disabled={unpublishDisabled}
                >
                  <Upload className="h-3 w-3" />
                  {t('marketplace.unpublish.button')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('marketplace.unpublish.title')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('marketplace.unpublish.description', { name: workflow.name })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('marketplace.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive hover:bg-destructive/90"
                    onClick={() => onUnpublish(workflow)}
                  >
                    {t('marketplace.unpublish.confirm')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            disabled={deleteDisabled}
            onClick={() => onDelete(workflow)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
