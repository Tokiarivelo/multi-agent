'use client';

import { useWorkflows, useDeleteWorkflow } from '../hooks/useWorkflows';
import { useTranslation } from 'react-i18next';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Play, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { formatRelativeTime, getStatusColor } from '@/lib/utils';
import { useState } from 'react';
import { CreateWorkflowModal } from './CreateWorkflowModal';
import { DeleteGuardDialog } from '@/components/shared/DeleteGuardDialog';
import { useDeleteGuard } from '@/hooks/useDeleteGuard';
import { Workflow } from '@/types';

export function WorkflowList() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useWorkflows();
  const deleteWorkflow = useDeleteWorkflow();
  const deleteGuard = useDeleteGuard('workflow');
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingDeleteWorkflow, setPendingDeleteWorkflow] = useState<Workflow | null>(null);

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
                  <TableHead>{t('workflows.table.updated')}</TableHead>
                  <TableHead>{t('workflows.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map((workflow) => (
                  <TableRow key={workflow.id}>
                    <TableCell className="font-medium">
                      <Link href={`/workflows/${workflow.id}`} className="hover:underline">
                        {workflow.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {workflow.description || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          getStatusColor(workflow.status) as
                            | 'default'
                            | 'success'
                            | 'warning'
                            | 'destructive'
                        }
                      >
                        {workflow.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{workflow.definition?.nodes?.length || 0}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeTime(workflow.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
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
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          disabled={deleteWorkflow.isPending}
                          onClick={() => { setPendingDeleteWorkflow(workflow); deleteGuard.openGuard(workflow.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <DeleteGuardDialog
        open={deleteGuard.open}
        onOpenChange={(open) => { if (!open) { deleteGuard.close(); setPendingDeleteWorkflow(null); } }}
        entityName={pendingDeleteWorkflow?.name ?? ''}
        entityType={t('deleteGuard.types.workflow')}
        dependencies={deleteGuard.dependencies}
        isChecking={deleteGuard.isChecking}
        isDeleting={deleteWorkflow.isPending}
        onConfirm={() => {
          if (!pendingDeleteWorkflow) return;
          deleteWorkflow.mutate(pendingDeleteWorkflow.id, {
            onSuccess: () => { deleteGuard.close(); setPendingDeleteWorkflow(null); },
          });
        }}
      />
    </div>
  );
}
