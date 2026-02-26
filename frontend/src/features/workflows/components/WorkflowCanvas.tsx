'use client';

import { useCallback, useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Connection,
  type NodeTypes,
  type Edge,
  BackgroundVariant,
  Panel,
  type Node,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import { Workflow } from '@/types';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Settings2 } from 'lucide-react';
import { NodeEditor } from './NodeEditor';
import { WorkflowFlowNode } from './WorkflowFlowNode';
import { AddNodePayload, AddEdgePayload } from '../api/workflows.api';
import {
  useAddNode,
  useDeleteNode,
  useAddEdge,
  useDeleteEdge,
  useUpdateNode,
} from '../hooks/useWorkflows';
import { useAgents } from '../../agents/hooks/useAgents';
import { useTools } from '../../tools/hooks/useTools';
import { getNodeTypeMeta, NodeTypeId } from './nodeTypes';

interface WorkflowCanvasProps {
  workflow: Workflow;
}

/* ─── Node data payload (what lives inside node.data) ─────────────────── */
export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  labelFr: string;
  customName?: string;
  nodeType: string;
  config: Record<string, unknown>;
  meta: ReturnType<typeof getNodeTypeMeta>;
}

/* ─── Derived full-node type ──────────────────────────────────────────── */
type FlowNode = Node<WorkflowNodeData>;

/* ─── Registered custom node types ───────────────────────────────────── */
const nodeTypes: NodeTypes = {
  workflowNode: WorkflowFlowNode,
};

/* ─── Converters ──────────────────────────────────────────────────────── */
function resolveNodeLabel(
  nodeType: string,
  config: Record<string, unknown>,
  meta: ReturnType<typeof getNodeTypeMeta>,
  agents: { id: string; name: string }[],
  tools: { id: string; name: string }[],
  customName?: string,
): { label: string; labelFr: string } {
  if (customName && customName.trim()) {
    return { label: customName, labelFr: customName };
  }
  if (nodeType === 'AGENT' && config?.agentId) {
    const agent = agents.find((a) => a.id === config.agentId);
    if (agent) return { label: agent.name, labelFr: agent.name };
  }
  if (nodeType === 'TOOL' && config?.toolId) {
    const tool = tools.find((t) => t.id === config.toolId);
    if (tool) return { label: tool.name, labelFr: tool.name };
  }
  return { label: meta.label, labelFr: meta.labelFr };
}

function toFlowNode(
  n: Workflow['definition']['nodes'][0],
  agents: { id: string; name: string }[],
  tools: { id: string; name: string }[],
): FlowNode {
  const raw = n as unknown as Record<string, unknown>;
  const meta = getNodeTypeMeta(raw.type as string);
  const config =
    (raw.config as Record<string, unknown>) ?? (raw.data as Record<string, unknown>) ?? {};
  const customName = raw.customName as string | undefined;
  const { label, labelFr } = resolveNodeLabel(
    raw.type as string,
    config,
    meta,
    agents,
    tools,
    customName,
  );

  return {
    id: n.id,
    type: 'workflowNode',
    position: (raw.position as { x: number; y: number }) ?? { x: 100, y: 100 },
    data: {
      label,
      labelFr,
      nodeType: raw.type as string,
      customName,
      config,
      meta,
    },
  };
}

function toFlowEdge(edge: Workflow['definition']['edges'][0]): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.condition,
    animated: false,
    style: { stroke: 'hsl(var(--border))', strokeWidth: 2 },
    labelStyle: { fill: 'hsl(var(--muted-foreground))', fontSize: 11 },
  };
}

function makeFlowNode(
  node: AddNodePayload,
  agents: { id: string; name: string }[],
  tools: { id: string; name: string }[],
): FlowNode {
  const meta = getNodeTypeMeta(node.type);
  const config = node.config ?? {};
  const { label, labelFr } = resolveNodeLabel(
    node.type,
    config,
    meta,
    agents,
    tools,
    node.customName,
  );

  return {
    id: node.id,
    type: 'workflowNode',
    position: node.position ?? { x: 200, y: 200 },
    data: {
      label,
      labelFr,
      nodeType: node.type as string,
      customName: node.customName,
      config,
      meta,
    },
  };
}

/* ─── Inner canvas ────────────────────────────────────────────────────── */
function WorkflowCanvasInner({ workflow }: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  const addNodeMutation = useAddNode(workflow.id);
  const updateNodeMutation = useUpdateNode(workflow.id);
  const deleteNodeMutation = useDeleteNode(workflow.id);
  const addEdgeMutation = useAddEdge(workflow.id);
  const deleteEdgeMutation = useDeleteEdge(workflow.id);

  const { resolvedTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const { zoomIn, zoomOut } = useReactFlow();

  const { data: agentsData } = useAgents(1, 100);
  const { data: toolsData } = useTools(1, 100);

  /* Handle + and - zooming */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't zoom if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === '+' || e.key === '=') {
        zoomIn({ duration: 200 });
      } else if (e.key === '-') {
        zoomOut({ duration: 200 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut]);

  /* Sync when workflow prop changes externally, or when agents/tools load */
  useEffect(() => {
    const agents = agentsData?.data ?? [];
    const tools = toolsData?.data ?? [];
    setNodes(workflow.definition?.nodes?.map((n) => toFlowNode(n, agents, tools)) ?? []);
    setEdges(workflow.definition?.edges?.map(toFlowEdge) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.definition?.nodes, workflow.definition?.edges, agentsData?.data, toolsData?.data]);

  /* User draws a new edge */
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        // Prevent duplicate edges
        const exists = eds.some(
          (e) => e.source === connection.source && e.target === connection.target,
        );
        if (exists) return eds;

        const newEdge: AddEdgePayload = {
          id: uuidv4(),
          source: connection.source!,
          target: connection.target!,
        };

        addEdgeMutation.mutate(newEdge);

        return addEdge(
          {
            ...newEdge,
            style: { stroke: 'hsl(var(--border))', strokeWidth: 2 },
          },
          eds,
        );
      });
    },
    [setEdges, addEdgeMutation],
  );

  /* Save node from dialog */
  const handleSaveNode = (node: AddNodePayload) => {
    if (editingNodeId) {
      updateNodeMutation.mutate(
        { nodeId: node.id, node },
        {
          onSuccess: () => {
            setNodes((prev) =>
              prev.map((n) =>
                n.id === node.id
                  ? makeFlowNode(node, agentsData?.data ?? [], toolsData?.data ?? [])
                  : n,
              ),
            );
            setEditorOpen(false);
          },
        },
      );
    } else {
      addNodeMutation.mutate(node, {
        onSuccess: () => {
          setNodes((prev) => [
            ...prev,
            makeFlowNode(node, agentsData?.data ?? [], toolsData?.data ?? []),
          ]);
          setEditorOpen(false);
        },
      });
    }
  };

  /* Selected node */
  const selectedNode = nodes.find((n) => n.selected) ?? null;
  const selectedData = selectedNode?.data as WorkflowNodeData | undefined;
  const selectedMeta = selectedData ? getNodeTypeMeta(selectedData.nodeType as NodeTypeId) : null;

  const selectedEdge = edges.find((e) => e.selected) ?? null;

  const handleDeleteSelected = () => {
    if (selectedNode) {
      deleteNodeMutation.mutate(selectedNode.id, {
        onSuccess: () => setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id)),
      });
    } else if (selectedEdge) {
      deleteEdgeMutation.mutate(selectedEdge.id, {
        onSuccess: () => setEdges((prev) => prev.filter((e) => e.id !== selectedEdge.id)),
      });
    }
  };

  /* Editing node initial data for dialog */
  const editingNode = editingNodeId ? nodes.find((n) => n.id === editingNodeId) : undefined;
  const editingData = editingNode?.data as WorkflowNodeData | undefined;

  const editingInitial =
    editingNode && editingData
      ? {
          id: editingNode.id,
          type: editingData.nodeType as NodeTypeId,
          customName: editingData.customName,
          config: editingData.config,
          position: editingNode.position as { x: number; y: number },
        }
      : undefined;

  return (
    <div className="h-full w-full relative overflow-hidden bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={(_, node) => {
          if (workflow?.id && node.id) {
            const nd = node as FlowNode;
            updateNodeMutation.mutate({
              nodeId: nd.id,
              node: { position: nd.position },
            });
          }
        }}
        onNodeDoubleClick={(_, node) => {
          setEditingNodeId(node.id);
          setEditorOpen(true);
        }}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode={null}
        className="bg-background"
        colorMode={resolvedTheme === 'dark' ? 'dark' : 'light'}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="opacity-30" />
        <Controls className="bg-card border-border/50 rounded-lg shadow-sm overflow-hidden" />
        <MiniMap
          className="bg-card border-border/50 rounded-lg shadow-sm"
          nodeColor={(n) => {
            const d = n.data as WorkflowNodeData;
            const meta = getNodeTypeMeta(d?.nodeType as string);
            const colorMap: Record<string, string> = {
              emerald: '#10b981',
              rose: '#f43f5e',
              violet: '#8b5cf6',
              amber: '#f59e0b',
              sky: '#0ea5e9',
              orange: '#f97316',
            };
            const colorKey = meta.color.split('-')[1] ?? 'violet';
            return colorMap[colorKey] ?? '#8b5cf6';
          }}
        />

        {/* Toolbar */}
        <Panel position="top-left" className="mt-24!">
          <div className="flex items-center gap-2 bg-background/30 backdrop-blur-xl border border-border/30 rounded-lg px-3 py-2 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground mr-1">
              {t('workflows.canvas.title')}
            </span>
            <Button
              size="sm"
              variant="default"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                setEditingNodeId(null);
                setEditorOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('workflows.canvas.addNode')}
            </Button>

            {selectedNode && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={() => {
                    setEditingNodeId(selectedNode.id);
                    setEditorOpen(true);
                  }}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  {t('workflows.canvas.edit')}
                </Button>
                {selectedMeta && (
                  <Badge variant="secondary" className="text-xs">
                    {i18n.language.startsWith('fr') ? selectedMeta.labelFr : selectedMeta.label}
                  </Badge>
                )}
              </>
            )}
            {(selectedNode || selectedEdge) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                onClick={handleDeleteSelected}
                disabled={deleteNodeMutation.isPending || deleteEdgeMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('workflows.canvas.delete')}
              </Button>
            )}
          </div>
        </Panel>

        {/* Stats */}
        <Panel position="top-right" className="mt-24!">
          <div className="bg-background/30 backdrop-blur-xl border border-border/30 rounded-lg px-3 py-2 shadow-sm text-xs text-muted-foreground">
            {nodes.length}{' '}
            {nodes.length !== 1 ? t('workflows.canvas.nodes') : t('workflows.canvas.node')} ·{' '}
            {edges.length}{' '}
            {edges.length !== 1 ? t('workflows.canvas.edges') : t('workflows.canvas.edge')}
          </div>
        </Panel>
      </ReactFlow>

      {/* Node Editor Dialog */}
      <NodeEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSaveNode}
        initialNode={editingInitial}
        isSaving={addNodeMutation.isPending || updateNodeMutation.isPending}
        agents={agentsData?.data ?? []}
        tools={toolsData?.data ?? []}
      />
    </div>
  );
}

/* ─── Public export wrapped in provider ──────────────────────────────── */
export function WorkflowCanvas({ workflow }: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner workflow={workflow} />
    </ReactFlowProvider>
  );
}
