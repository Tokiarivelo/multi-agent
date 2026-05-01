'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import {
  useCreateWorkflow,
  useUpdateWorkflow,
  useDeleteWorkflow,
  useExecuteWorkflow,
  useCancelExecution,
  useUpdateNode,
} from '../hooks/useWorkflows';
import { useWorkflowLogs } from '../hooks/useWorkflowLogs';
import { Workflow, WorkflowNode } from '@/types';
import { WorkflowExecution, NodeExecution } from '../api/workflows.api';
import { useWorkflowExecutionStore, NodeStatus } from '../store/workflowExecution.store';
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore';
import { writeFileAtPath, useWorkspace } from '@/features/workspace/hooks/useWorkspace';
import { toast } from 'sonner';
import { WorkflowIOField } from './WorkflowIOPanel';
import { useRouter, useSearchParams } from 'next/navigation';
import { useExecution } from '../hooks/useWorkflows';
import { QuestionType } from './AgentReplyBar';
import { WaitingInputModal } from './WaitingInputModal';
import { WorkflowEditorHeader } from './WorkflowEditorHeader';
import { WorkflowExecutionPanel } from './WorkflowExecutionPanel';
import { WorkflowDetailsPanel } from './WorkflowDetailsPanel';

interface WorkflowEditorProps {
  workflow?: Workflow;
}

export function WorkflowEditor({ workflow }: WorkflowEditorProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const SEARCH_PARAMS = useSearchParams();
  const deepExecutionId = SEARCH_PARAMS.get('executionId');

  const [name, setName] = useState(workflow?.name ?? '');
  const [description, setDescription] = useState(workflow?.description ?? '');
  const [status, setStatus] = useState(workflow?.status?.toUpperCase() ?? 'DRAFT');
  const [logsOpen, setLogsOpen] = useState(!!deepExecutionId);
  const [panelOpen, setPanelOpen] = useState(false);
  const [outputLogsToFile, setOutputLogsToFile] = useState(false);

  const [inputSchema, setInputSchema] = useState<WorkflowIOField[]>(
    (workflow?.definition?.inputSchema as WorkflowIOField[] | undefined) ?? [],
  );
  const [outputSchema, setOutputSchema] = useState<WorkflowIOField[]>(
    (workflow?.definition?.outputSchema as WorkflowIOField[] | undefined) ?? [],
  );

  const setActiveExecutionId = useWorkflowExecutionStore((s) => s.setActiveExecutionId);
  const activeExecutionId = useWorkflowExecutionStore((s) => s.activeExecutionId);
  const selectedNodeId = useWorkflowExecutionStore((s) => s.selectedNodeId);
  const selectedNodeName = useWorkflowExecutionStore((s) => s.selectedNodeName);
  const nodeData = useWorkflowExecutionStore((s) => s.nodeData);
  const nodeTurns = useWorkflowExecutionStore((s) => s.nodeTurns);
  const nodeStatuses = useWorkflowExecutionStore((s) => s.nodeStatuses);
  const subExecutions = useWorkflowExecutionStore((s) => s.subExecutions);

  const {
    waitingNodeId,
    waitingPrompt,
    waitingAgentText,
    waitingProposals,
    waitingQuestionType,
  } = useMemo(() => {
    const nodeId =
      Object.keys(nodeStatuses).find((id) => nodeStatuses[id] === 'WAITING_INPUT') ?? null;
    const raw = nodeId ? (nodeData[nodeId] as Record<string, unknown> | undefined) : undefined;

    return {
      waitingNodeId: nodeId,
      waitingPrompt: (raw?.prompt as string | undefined) ?? null,
      waitingAgentText: (raw?.agentMessage as string | undefined) ?? null,
      waitingProposals: (raw?.proposals as string[] | undefined) ?? [],
      waitingQuestionType: (raw?.questionType as QuestionType | undefined) ?? 'custom',
    };
  }, [nodeStatuses, nodeData]);

  const [activeExecution, setActiveExecution] = useState<WorkflowExecution | null>(null);

  useEffect(() => {
    if (deepExecutionId) setActiveExecutionId(deepExecutionId);
  }, [deepExecutionId, setActiveExecutionId]);

  const { data: executionData } = useExecution(deepExecutionId);

  useEffect(() => {
    if (!executionData) return;
    const store = useWorkflowExecutionStore.getState();
    store.setExecutionStatus(executionData.status);
    if (executionData.nodeExecutions) {
      executionData.nodeExecutions.forEach((ne: NodeExecution) => {
        store.setNodeStatus(ne.nodeId, ne.status as NodeStatus);
        if (ne.output !== undefined || ne.error !== undefined) {
          store.setNodeData(ne.nodeId, { input: ne.input, output: ne.output, error: ne.error });
        }
      });
    }
    queueMicrotask(() => setActiveExecution(executionData as WorkflowExecution));
  }, [executionData]);

  const createWorkflow = useCreateWorkflow();
  const updateWorkflow = useUpdateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();
  const executeWorkflow = useExecuteWorkflow();
  const cancelExecution = useCancelExecution();

  const { logs, connected, executionStatus, clearLogs } = useWorkflowLogs({
    executionId: activeExecution?.id ?? null,
  });
  const { refreshTree, ensureWorkspacePermission } = useWorkspace();

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string;
        const data = JSON.parse(json);

        if (data.name) setName(data.name);
        if (data.description) setDescription(data.description);

        const payload = {
          name: data.name || name,
          description: data.description || description,
          definition: data.definition || { nodes: [], edges: [], version: 1 },
          status: data.status || status,
        };

        if (workflow?.id) {
          updateWorkflow.mutate({ id: workflow.id, workflow: payload });
        } else {
          createWorkflow.mutate(payload);
        }

        toast.success(t('workflows.editor.importSuccess', 'Workflow imported successfully!'));
      } catch (err) {
        toast.error(`Invalid JSON file: ${err instanceof Error ? err.message : String(err)}`);
      }

      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
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
        inputSchema,
        outputSchema,
      },
      status: status.toUpperCase() as Workflow['status'],
    };

    const activeWs = useWorkspaceStore.getState().getActiveWorkspace?.() ?? null;
    if (activeWs?.rootHandle) {
      try {
        const ok = await ensureWorkspacePermission(activeWs.id, 'readwrite');
        if (!ok) {
          toast.error(t('workspace.permissionDenied', 'Permission denied. Cannot save locally.'));
        } else {
          const rawName = name || workflow?.id || 'untitled_workflow';
          const fileName = `${rawName.replace(/\s+/g, '_').toLowerCase()}.json`;
          await writeFileAtPath(activeWs.rootHandle, fileName, JSON.stringify(workflowData, null, 2));
          await refreshTree(activeWs.id);
          toast.success(`Saved to workspace locally: ${fileName}`);
        }
      } catch (err) {
        toast.error(`Failed to save locally: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (workflow?.id) {
      updateWorkflow.mutate({ id: workflow.id, workflow: workflowData });
    } else {
      createWorkflow.mutate(workflowData);
    }
  };

  const updateNode = useUpdateNode(workflow?.id ?? '');
  const handleApplyNodeFix = (nodeId: string, fixedConfig: Record<string, unknown>) => {
    updateNode.mutate({ nodeId, node: { config: fixedConfig } });
  };

  const handleEditNodeAi = (nodeId: string) => {
    // Dispatch a custom event that WorkflowCanvas listens to
    window.dispatchEvent(
      new CustomEvent('workflow-node-action', {
        detail: { nodeId, action: 'edit', initialAiOpen: true },
      }),
    );
  };

  const handleExecute = () => {
    if (!workflow?.id) return;
    clearLogs();
    setLogsOpen(true);

    const activeWs = useWorkspaceStore.getState().getActiveWorkspace?.() ?? null;
    const input = {
      ...(activeWs?.nativePath ? { cwd: activeWs.nativePath } : {}),
      ...(activeWs?.id ? { workspaceId: activeWs.id } : {}),
      ...(outputLogsToFile ? { outputLogsToFile: true } : {}),
    };

    executeWorkflow.mutate(
      { id: workflow.id, input },
      {
        onSuccess: (execution) => {
          setActiveExecution(execution);
          setActiveExecutionId(execution.id);
        },
      },
    );
  };

  const handleCancelExecution = useCallback(() => {
    if (!activeExecution) return;
    cancelExecution.mutate(activeExecution.id, {
      onSuccess: () => {
        setActiveExecution(null);
        setActiveExecutionId(null);
      },
    });
  }, [activeExecution, cancelExecution, setActiveExecutionId]);

  const isSaving = createWorkflow.isPending || updateWorkflow.isPending;
  const isWorkflowRunning =
    !!(activeExecution || activeExecutionId) &&
    (executionStatus === 'RUNNING' || executionStatus === 'PENDING' || executeWorkflow.isPending);

  return (
    <div className="flex flex-col h-full w-full pointer-events-none z-50 overflow-hidden relative">
      {/* ─── WAITING_INPUT overlay ─── */}
      {waitingNodeId && (activeExecution || activeExecutionId) && (
        <WaitingInputModal
          waitingNodeId={waitingNodeId}
          executionId={activeExecution?.id ?? activeExecutionId}
          waitingPrompt={waitingPrompt}
          waitingAgentText={waitingAgentText}
          waitingProposals={waitingProposals}
          waitingQuestionType={waitingQuestionType}
          onCancel={handleCancelExecution}
          isCancelling={cancelExecution.isPending}
        />
      )}

      {/* Hidden file input for import */}
      <input
        type="file"
        accept=".json"
        ref={fileInputRef}
        aria-hidden="true"
        className="hidden"
        onChange={handleImport}
      />

      {/* ─── Header ─── */}
      <WorkflowEditorHeader
        workflow={workflow}
        status={status}
        logsOpen={logsOpen}
        outputLogsToFile={outputLogsToFile}
        isSaving={isSaving}
        isExecuting={executeWorkflow.isPending}
        isRunning={isWorkflowRunning}
        isCancelling={cancelExecution.isPending}
        panelOpen={panelOpen}
        fileInputRef={fileInputRef}
        onBack={() => router.push('/workflows')}
        onSave={handleSave}
        onExecute={handleExecute}
        onCancel={handleCancelExecution}
        onToggleLogs={() => setLogsOpen((v) => !v)}
        onTogglePanel={() => setPanelOpen((v) => !v)}
        onDelete={() => deleteWorkflow.mutate(workflow!.id)}
        onOutputLogsChange={setOutputLogsToFile}
      />

      {/* ─── Right side panel ─── */}
      <div className="flex-1 relative flex justify-end w-full overflow-hidden">
        {panelOpen && (
          <WorkflowDetailsPanel
            workflow={workflow}
            name={name}
            description={description}
            status={status}
            inputSchema={inputSchema}
            outputSchema={outputSchema}
            onNameChange={setName}
            onDescriptionChange={setDescription}
            onStatusChange={setStatus}
            onInputSchemaChange={setInputSchema}
            onOutputSchemaChange={setOutputSchema}
          />
        )}
      </div>

      {/* ─── Bottom execution panel ─── */}
      {logsOpen && workflow?.id && (
        <WorkflowExecutionPanel
          logs={logs}
          connected={connected}
          executionStatus={executionStatus}
          executionId={activeExecution?.id ?? null}
          subExecutionsCount={subExecutions.length}
          selectedNodeId={selectedNodeId}
          selectedNodeName={selectedNodeName}
          nodeStatuses={nodeStatuses}
          nodeData={nodeData}
          nodeTurns={nodeTurns}
          isCancelling={cancelExecution.isPending}
          onClear={clearLogs}
          onCancel={handleCancelExecution}
          onClose={() => setLogsOpen(false)}
          onApplyNodeFix={handleApplyNodeFix}
          onEditNodeAi={handleEditNodeAi}
        />
      )}
    </div>
  );
}
