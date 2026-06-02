'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useMyPublished } from '../hooks/useMarketplace';
import { marketplaceApi } from '../api/marketplace.api';
import { MyPublishedWorkflow } from '../types/marketplace.types';
import { InstallersModal } from './InstallersModal';
import { PublishToMarketplaceModal } from './PublishToMarketplaceModal';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Users, Edit, Upload } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';

export function PublishedWorkflowsList() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: published = [], isLoading } = useMyPublished(user?.id);

  const [installersTarget, setInstallersTarget] = useState<MyPublishedWorkflow | null>(null);
  const [editTarget, setEditTarget] = useState<MyPublishedWorkflow | null>(null);

  const unpublishMutation = useMutation({
    mutationFn: (workflowId: string) => marketplaceApi.unpublish(workflowId, user!.id),
    onSuccess: () => {
      toast.success(t('marketplace.unpublish.success'));
      queryClient.invalidateQueries({ queryKey: ['marketplace-my-published'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-templates'] });
    },
    onError: () => toast.error(t('marketplace.unpublish.error')),
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('marketplace.myPublished.title')}</CardTitle>
          <CardDescription>{t('marketplace.myPublished.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {published.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t('marketplace.myPublished.empty')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('marketplace.myPublished.col.name')}</TableHead>
                  <TableHead>{t('marketplace.myPublished.col.category')}</TableHead>
                  <TableHead>{t('marketplace.myPublished.col.installs')}</TableHead>
                  <TableHead>{t('marketplace.myPublished.col.published')}</TableHead>
                  <TableHead>{t('marketplace.myPublished.col.status')}</TableHead>
                  <TableHead>{t('marketplace.myPublished.col.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {published.map((wf) => (
                  <TableRow key={wf.id}>
                    <TableCell className="font-medium">{wf.name}</TableCell>
                    <TableCell>{wf.category ?? '—'}</TableCell>
                    <TableCell>{wf.installsCount}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeTime(wf.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={wf.isTemplate ? 'success' : 'secondary'}>
                        {wf.isTemplate
                          ? t('marketplace.badge.published')
                          : t('marketplace.unpublish.button')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => setInstallersTarget(wf)}
                        >
                          <Users className="h-3 w-3" />
                          {t('marketplace.installers.button')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => setEditTarget(wf)}
                        >
                          <Edit className="h-3 w-3" />
                          {t('marketplace.update.submit')}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 hover:text-destructive"
                              disabled={unpublishMutation.isPending}
                            >
                              <Upload className="h-3 w-3" />
                              {t('marketplace.unpublish.button')}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('marketplace.unpublish.title')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('marketplace.unpublish.description', { name: wf.name })}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('marketplace.cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive hover:bg-destructive/90"
                                onClick={() => unpublishMutation.mutate(wf.id)}
                              >
                                {t('marketplace.unpublish.confirm')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {installersTarget && user?.id && (
        <InstallersModal
          open={!!installersTarget}
          onClose={() => setInstallersTarget(null)}
          templateId={installersTarget.id}
          templateName={installersTarget.name}
          userId={user.id}
        />
      )}

      {editTarget && user?.id && (
        <PublishToMarketplaceModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          workflowId={editTarget.id}
          workflowName={editTarget.name}
          userId={user.id}
          isAdmin={user.role === 'ADMIN'}
          isPublished={true}
          initialValues={{ name: editTarget.name, category: editTarget.category ?? undefined }}
        />
      )}
    </>
  );
}
