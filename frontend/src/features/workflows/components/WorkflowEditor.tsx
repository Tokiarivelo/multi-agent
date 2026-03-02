'use client';

import { useState, useCallback } from 'react';
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
import { useWorkflowExecutionStore } from '../store/workflowExecution.store';
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
  X,
  FileJson,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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

  const setActiveExecutionId = useWorkflowExecutionStore((s) => s.setActiveExecutionId);
  const selectedNodeId = useWorkflowExecutionStore((s) => s.selectedNodeId);
  const selectedNodeName = useWorkflowExecutionStore((s) => s.selectedNodeName);
  const nodeData = useWorkflowExecutionStore((s) => s.nodeData);
  const nodeStatuses = useWorkflowExecutionStore((s) => s.nodeStatuses);

  const [activeExecution, setActiveExecution] = useState<WorkflowExecution | null>(null);

  const [bottomPanelHeight, setBottomPanelHeight] = useState(350);

  const handleDragStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = bottomPanelHeight;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaY = startY - moveEvent.clientY;
        setBottomPanelHeight(
          Math.max(150, Math.min(window.innerHeight - 100, startHeight + deltaY)),
        );
      };

      const handlePointerUp = () => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    },
    [bottomPanelHeight],
  );

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
          setActiveExecutionId(execution.id);
        },
      },
    );
  };

  // ─── Cancel execution ─────────────────────────────────────────────
  const handleCancelExecution = () => {
    if (!activeExecution) return;
    cancelExecution.mutate(activeExecution.id, {
      onSuccess: () => {
        setActiveExecution(null);
        setActiveExecutionId(null);
      },
    });
  };

  const handleToggleLogs = () => {
    setLogsOpen((v) => !v);
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
          </div>
        )}
      </div>

      {/* ─── Bottom Panel (Execution & Node Data) ─── */}
      {logsOpen && workflow?.id && (
        <div
          className="relative w-full shrink-0 shadow-xl rounded-t-xl overflow-hidden border border-border/50 bg-white/60 dark:bg-black/60 backdrop-blur-xl pointer-events-auto flex flex-col"
          style={{ height: bottomPanelHeight }}
        >
          {/* Resize Handle */}
          <div
            className="absolute top-0 left-0 right-0 h-[6px] cursor-row-resize z-50 bg-transparent hover:bg-primary/20 transition-colors"
            onPointerDown={handleDragStart}
          />
          <Tabs defaultValue="logs" className="flex-1 flex flex-col min-h-0 pt-1">
            <div className="flex items-center justify-between px-4 pt-2 border-b border-border/50 pb-2">
              <TabsList className="bg-background/50 backdrop-blur-sm">
                <TabsTrigger value="logs" className="gap-2 text-xs">
                  <Terminal className="h-3.5 w-3.5" />
                  Execution Logs
                </TabsTrigger>
                <TabsTrigger value="node-data" className="gap-2 text-xs">
                  <FileJson className="h-3.5 w-3.5" />
                  Node Execution Data
                </TabsTrigger>
              </TabsList>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setLogsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <TabsContent
              value="logs"
              className="flex-1 min-h-0 m-0 border-0 p-0 overflow-hidden outline-none flex flex-col"
            >
              <ExecutionLogsPanel
                logs={logs}
                connected={connected}
                executionStatus={executionStatus}
                executionId={activeExecution?.id ?? null}
                onClear={clearLogs}
                onCancel={handleCancelExecution}
                isCancelling={cancelExecution.isPending}
              />
            </TabsContent>

            <TabsContent
              value="node-data"
              className="flex-1 min-h-0 m-0 border-0 overflow-hidden outline-none flex flex-col"
            >
              <ScrollArea className="h-full">
                <div className="p-4 flex flex-col gap-4">
                  {!selectedNodeId ? (
                    <div className="text-sm text-muted-foreground italic flex h-full items-center justify-center min-h-[100px]">
                      {t(
                        'workflows.editor.selectNodeMsg',
                        'Select a node on the canvas to view its execution data.',
                      )}
                    </div>
                  ) : !nodeStatuses[selectedNodeId] ? (
                    <div className="text-sm text-muted-foreground flex h-full items-center justify-center min-h-[100px]">
                      {selectedNodeName ? `Node '${selectedNodeName}'` : `Node`} [{selectedNodeId}]
                      has not executed yet.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">
                          Node:{' '}
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded mr-1">
                            {selectedNodeName || 'Unknown'}
                          </code>
                          <span className="text-muted-foreground text-xs font-normal">
                            [{selectedNodeId}]
                          </span>
                        </span>
                        <Badge
                          variant={
                            nodeStatuses[selectedNodeId] === 'COMPLETED'
                              ? 'success'
                              : nodeStatuses[selectedNodeId] === 'FAILED'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {nodeStatuses[selectedNodeId]}
                        </Badge>
                      </div>
                      <div className="mt-2 bg-muted/30 rounded-lg border border-border/50 p-4">
                        <pre className="text-xs font-mono overflow-auto max-w-full text-foreground/80">
                          {nodeData[selectedNodeId] !== undefined
                            ? JSON.stringify(nodeData[selectedNodeId], null, 2)
                            : 'No output/input recorded.'}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
