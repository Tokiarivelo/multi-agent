'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import {
  useCreateWorkflow,
  useUpdateWorkflow,
  useDeleteWorkflow,
  useExecuteWorkflow,
  useCancelExecution,
} from '../hooks/useWorkflows';
import { useWorkflowLogs } from '../hooks/useWorkflowLogs';
import { Workflow, WorkflowNode } from '@/types';
import { WorkflowExecution } from '../api/workflows.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Save,
  Play,
  Trash2,
  Terminal,
  ChevronLeft,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { ExecutionLogsPanel } from './ExecutionLogsPanel';
import { useRouter } from 'next/navigation';

interface WorkflowEditorProps {
  workflow?: Workflow;
}

const STATUS_OPTIONS = ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;
const STATUS_VARIANT: Record<
  string,
  'default' | 'success' | 'destructive' | 'warning' | 'secondary'
> = {
  DRAFT: 'secondary',
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  ARCHIVED: 'secondary',
};

export function WorkflowEditor({ workflow }: WorkflowEditorProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState(workflow?.name ?? '');
  const [description, setDescription] = useState(workflow?.description ?? '');
  const [status, setStatus] = useState(workflow?.status?.toUpperCase() ?? 'DRAFT');
  const [logsOpen, setLogsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeExecution, setActiveExecution] = useState<WorkflowExecution | null>(null);

  const createWorkflow = useCreateWorkflow();
  const updateWorkflow = useUpdateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();
  const executeWorkflow = useExecuteWorkflow();
  const cancelExecution = useCancelExecution();

  const { logs, connected, executionStatus, clearLogs } = useWorkflowLogs({
    executionId: activeExecution?.id ?? null,
  });

  // ─── Save ─────────────────────────────────────────────────────────
  const handleSave = () => {
    const workflowData = {
      name,
      description,
      definition: {
        nodes:
          workflow?.definition?.nodes && workflow.definition.nodes.length > 0
            ? workflow.definition.nodes
            : ([
                {
                  id: uuidv4(),
                  type: 'START',
                  data: { label: t('workflows.editor.start'), nodeType: 'START' },
                  position: { x: 100, y: 150 },
                  config: {},
                },
                {
                  id: uuidv4(),
                  type: 'END',
                  data: { label: t('workflows.editor.end'), nodeType: 'END' },
                  position: { x: 600, y: 150 },
                  config: {},
                },
              ] as WorkflowNode[]),
        edges: workflow?.definition?.edges ?? [],
        version: workflow?.definition?.version ?? 1,
      },
      status: status.toUpperCase() as Workflow['status'],
    };

    if (workflow?.id) {
      updateWorkflow.mutate({ id: workflow.id, workflow: workflowData });
    } else {
      createWorkflow.mutate(workflowData);
    }
  };

  // ─── Execute ──────────────────────────────────────────────────────
  const handleExecute = () => {
    if (!workflow?.id) return;
    clearLogs();
    setLogsOpen(true);

    executeWorkflow.mutate(
      { id: workflow.id },
      {
        onSuccess: (execution) => {
          setActiveExecution(execution);
        },
      },
    );
  };

  // ─── Cancel execution ─────────────────────────────────────────────
  const handleCancelExecution = () => {
    if (!activeExecution) return;
    cancelExecution.mutate(activeExecution.id, {
      onSuccess: () => setActiveExecution(null),
    });
  };

  const handleToggleLogs = () => {
    setLogsOpen((v) => !v);
    // open pannel if not open
    if (!panelOpen && !logsOpen) {
      setPanelOpen(true);
    }
  };

  const isSaving = createWorkflow.isPending || updateWorkflow.isPending;

  return (
    <div className="flex flex-col h-full w-full pointer-events-none z-50 overflow-hidden">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between gap-3 flex-wrap p-2 px-4 rounded-xl bg-white/30 dark:bg-black/40 backdrop-blur-md border border-border/50 shadow-sm pointer-events-auto shrink-0 mb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => router.push('/workflows')}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-2xl font-bold">
            {workflow ? t('workflows.editor.edit') : t('workflows.editor.new')}
          </h2>
          {workflow && <Badge variant={STATUS_VARIANT[status] ?? 'default'}>{status}</Badge>}
        </div>

        <div className="flex items-center gap-2">
          {/* Execute */}
          {workflow?.id && (
            <Button
              variant="outline"
              onClick={handleExecute}
              disabled={executeWorkflow.isPending || status !== 'ACTIVE'}
              className="gap-2"
              title={
                status !== 'ACTIVE'
                  ? t('workflows.editor.activateToRun')
                  : t('workflows.actions.run')
              }
            >
              <Play className="h-4 w-4" />
              {executeWorkflow.isPending
                ? t('workflows.editor.running')
                : t('workflows.actions.run')}
            </Button>
          )}

          {/* Logs toggle */}
          {workflow?.id && (
            <Button
              variant={logsOpen ? 'secondary' : 'ghost'}
              size="icon"
              onClick={handleToggleLogs}
              title={t('workflows.editor.toggleLogs')}
            >
              <Terminal className="h-4 w-4" />
            </Button>
          )}

          {/* Save */}
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? t('workflows.editor.saving') : t('workflows.editor.save')}
          </Button>

          {/* Delete */}
          {workflow?.id && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('workflows.editor.deleteTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('workflows.editor.deleteDesc')?.replace('{name}', workflow.name)}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('workflows.editor.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive hover:bg-destructive/90"
                    onClick={() => deleteWorkflow.mutate(workflow.id)}
                  >
                    {t('workflows.editor.delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {/* Toggle Panel */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPanelOpen(!panelOpen)}
            title="Toggle Details Panel"
            className="ml-2 text-muted-foreground hover:text-foreground"
          >
            {panelOpen ? (
              <PanelRightClose className="h-5 w-5" />
            ) : (
              <PanelRightOpen className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* ─── Main Content Area (Right Panel floating) ─── */}
      <div className="flex-1 relative flex justify-end w-full overflow-hidden">
        {panelOpen && (
          <div className="w-[400px] h-full flex flex-col gap-4 overflow-y-auto pointer-events-auto pb-4 pr-1">
            {/* ─── Details ─── */}
            <Card className="backdrop-blur-xl bg-white/40 dark:bg-black/40 border-border/50 shadow-xl shrink-0 pointer-events-auto">
              <CardHeader>
                <CardTitle className="text-base">{t('workflows.editor.details')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="wf-name" className="text-sm font-medium">
                      {t('workflows.editor.nameLabel')}
                    </label>
                    <Input
                      id="wf-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('workflows.editor.namePlaceholder')}
                      required
                    />
                  </div>
                  {workflow && (
                    <div className="space-y-2">
                      <label htmlFor="wf-status" className="text-sm font-medium">
                        {t('workflows.editor.status')}
                      </label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger id="wf-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label htmlFor="wf-description" className="text-sm font-medium">
                    {t('workflows.editor.descLabel')}
                  </label>
                  <Textarea
                    id="wf-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('workflows.editor.descPlaceholder')}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* ─── Execution Logs Panel ─── */}
            {logsOpen && workflow?.id && (
              <div className="flex-1 min-h-[300px] flex flex-col shadow-xl rounded-xl overflow-hidden border border-border/50 bg-white/40 dark:bg-black/40 backdrop-blur-xl pointer-events-auto">
                <ExecutionLogsPanel
                  logs={logs}
                  connected={connected}
                  executionStatus={executionStatus}
                  executionId={activeExecution?.id ?? null}
                  onClear={clearLogs}
                  onCancel={handleCancelExecution}
                  isCancelling={cancelExecution.isPending}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
