'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Settings2, Undo2, Redo2, Wrench, ChevronLeft, ChevronRight, Cpu } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { NodeEditor } from './NodeEditor';
import { WorkflowFlowNode } from './WorkflowFlowNode';
import { WorkflowEdge } from './WorkflowEdge';
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
import { useWorkflowExecutionStore } from '../store/workflowExecution.store';
import { useWorkflowHistory } from '../hooks/useWorkflowHistory';

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
  /** Resolved tool names for the node — for AGENT nodes, from toolIds override OR agent's native tools */
  resolvedToolNames: string[];
  /** Resolved sub-agent names for the node */
  resolvedSubAgents: { name: string; role?: string }[];
}

/* ─── Derived full-node type ──────────────────────────────────────────── */
type FlowNode = Node<WorkflowNodeData>;

/* ─── Registered custom node types ───────────────────────────────────── */
const nodeTypes: NodeTypes = {
  workflowNode: WorkflowFlowNode,
};

const edgeTypes = {
  workflowEdge: WorkflowEdge,
};

/* ─── Converters ──────────────────────────────────────────────────────── */
function resolveAgentExtras(
  config: Record<string, unknown>,
  agents: { id: string; name: string; tools?: string[] }[],
  tools: { id: string; name: string; category?: string }[],
): { resolvedToolNames: string[]; resolvedSubAgents: { name: string; role?: string }[] } {
  // Node-level toolIds override → use those; otherwise fall back to agent's native tools
  const explicitToolIds = (config.toolIds as string[] | undefined) ?? [];
  let resolvedToolNames: string[];
  if (explicitToolIds.length > 0) {
    resolvedToolNames = explicitToolIds.map((tid) => tools.find((t) => t.id === tid)?.name ?? tid);
  } else {
    const agentId = config.agentId as string | undefined;
    const agent = agents.find((a) => a.id === agentId);
    resolvedToolNames = (agent?.tools ?? []).map(
      (tid) => tools.find((t) => t.id === tid)?.name ?? tid,
    );
  }

  const subAgents = (config.subAgents as { agentId: string; role?: string }[] | undefined) ?? [];
  const resolvedSubAgents = subAgents.map((sa) => ({
    name: agents.find((a) => a.id === sa.agentId)?.name ?? sa.agentId,
    role: sa.role,
  }));

  return { resolvedToolNames, resolvedSubAgents };
}

function resolveNodeLabel(
  nodeType: string,
  config: Record<string, unknown>,
  meta: ReturnType<typeof getNodeTypeMeta>,
  agents: { id: string; name: string; tools?: string[] }[],
  tools: { id: string; name: string; category?: string }[],
  customName?: string,
): { label: string; labelFr: string } {
  if (customName && customName.trim()) {
    return { label: customName, labelFr: customName };
  }
  if (nodeType === 'AGENT' && config?.agentId) {
    const agent = agents.find((a) => a.id === config.agentId);
    if (agent) return { label: agent.name, labelFr: agent.name };
  }
  if ((nodeType === 'TOOL' || nodeType === 'MCP') && config?.toolId) {
    const tool = tools.find((t) => t.id === config.toolId);
    if (tool) return { label: tool.name, labelFr: tool.name };
  }
  return { label: meta.label, labelFr: meta.labelFr };
}

function toFlowNode(
  n: Workflow['definition']['nodes'][0],
  agents: { id: string; name: string; tools?: string[] }[],
  tools: { id: string; name: string; category?: string }[],
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
  const { resolvedToolNames, resolvedSubAgents } = resolveAgentExtras(config, agents, tools);

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
      resolvedToolNames,
      resolvedSubAgents,
    },
  };
}

function toFlowEdge(edge: Workflow['definition']['edges'][0]): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'workflowEdge',
    label: edge.condition,
    animated: false,
    selectable: true,
    focusable: true,
    style: { stroke: 'hsl(var(--border))', strokeWidth: 2 },
    labelStyle: { fill: 'hsl(var(--muted-foreground))', fontSize: 11 },
  };
}

function makeFlowNode(
  node: AddNodePayload,
  agents: { id: string; name: string; tools?: string[] }[],
  tools: { id: string; name: string; category?: string }[],
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
  const { resolvedToolNames, resolvedSubAgents } = resolveAgentExtras(config, agents, tools);

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
      resolvedToolNames,
      resolvedSubAgents,
    },
  };
}

/* ─── Inner canvas ────────────────────────────────────────────────────── */
function WorkflowCanvasInner({ workflow }: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [splittingEdgeId, setSplittingEdgeId] = useState<string | null>(null);
  const [newNodePosition, setNewNodePosition] = useState<{ x: number; y: number } | undefined>(
    undefined,
  );

  const addNodeMutation = useAddNode(workflow.id);
  const updateNodeMutation = useUpdateNode(workflow.id);
  const deleteNodeMutation = useDeleteNode(workflow.id);
  const addEdgeMutation = useAddEdge(workflow.id);
  const deleteEdgeMutation = useDeleteEdge(workflow.id);

  const { resolvedTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const { zoomIn, zoomOut, screenToFlowPosition } = useReactFlow();

  const [paletteOpen, setPaletteOpen] = useState(true);

  /**
   * Edges deleted in the same JS tick as a node deletion are collected here.
   * `onEdgesDelete` fires before `onNodesDelete` (ReactFlow order), so we use
   * a setTimeout(0) to flush individual edge-history entries ONLY if no node
   * deletion happened in the same tick.
   */
  const pendingEdgeDeletes = useRef<AddEdgePayload[]>([]);
  const pendingEdgeFlushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /* Listen for edge split (plus button) */
  useEffect(() => {
    const handleSplitEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ edgeId: string }>).detail;
      setSplittingEdgeId(detail.edgeId);

      setEdges((currentEdges) => {
        const edge = currentEdges.find((ed) => ed.id === detail.edgeId);
        if (edge) {
          setNodes((currentNodes) => {
            const sourceNode = currentNodes.find((n) => n.id === edge.source);
            const targetNode = currentNodes.find((n) => n.id === edge.target);
            if (sourceNode && targetNode) {
              setNewNodePosition({
                x: (sourceNode.position.x + targetNode.position.x) / 2,
                y: (sourceNode.position.y + targetNode.position.y) / 2,
              });
            } else {
              setNewNodePosition({ x: 200, y: 200 });
            }
            return currentNodes;
          });
        }
        return currentEdges;
      });

      setEditingNodeId(null);
      setEditorOpen(true);
    };

    window.addEventListener('workflow-split-edge', handleSplitEvent);
    return () => window.removeEventListener('workflow-split-edge', handleSplitEvent);
  }, [setEdges, setNodes]);

  /* Listen for node quick-action events (edit / delete) dispatched from WorkflowFlowNode */
  useEffect(() => {
    const handleNodeAction = (e: Event) => {
      const { nodeId, action } = (e as CustomEvent<{ nodeId: string; action: 'edit' | 'delete' }>)
        .detail;

      if (action === 'edit') {
        setEditingNodeId(nodeId);
        setEditorOpen(true);
        return;
      }

      if (action === 'delete') {
        setNodes((currentNodes) => {
          const node = currentNodes.find((n) => n.id === nodeId);
          if (!node) return currentNodes;
          const data = node.data as WorkflowNodeData;
          if (data?.nodeType === 'START' || data?.nodeType === 'END') return currentNodes;

          const nodePayload: AddNodePayload = {
            id: node.id,
            type: data.nodeType as AddNodePayload['type'],
            customName: data.customName,
            config: data.config,
            position: node.position as { x: number; y: number },
          };

          const connectedEdges: AddEdgePayload[] = edges
            .filter((ed) => ed.source === nodeId || ed.target === nodeId)
            .map((ed) => ({
              id: ed.id,
              source: ed.source,
              target: ed.target,
              condition: ed.label as string | undefined,
            }));

          deleteNodeMutation.mutate(nodeId, {
            onSuccess: () => {
              setNodes((prev) => prev.filter((n) => n.id !== nodeId));
              pushHistory({ op: 'node_deleted', node: nodePayload, connectedEdges });
            },
          });

          return currentNodes;
        });
      }
    };

    window.addEventListener('workflow-node-action', handleNodeAction);
    return () => window.removeEventListener('workflow-node-action', handleNodeAction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, deleteNodeMutation, setNodes]);

  /* Sync when workflow prop changes externally, or when agents/tools load */
  useEffect(() => {
    const agents = agentsData?.data ?? [];
    const tools = toolsData?.data ?? [];

    setNodes((prevNodes) => {
      const newNodes = workflow.definition?.nodes?.map((n) => toFlowNode(n, agents, tools)) ?? [];
      return newNodes.map((nn) => {
        const existing = prevNodes.find((p) => p.id === nn.id);
        if (existing) {
          return {
            ...nn,
            // Preserve current React Flow state to prevent UI resets while executing
            position: existing.position,
            selected: existing.selected,
            dragging: existing.dragging,
          };
        }
        return nn;
      });
    });

    setEdges((prevEdges) => {
      const newEdges = workflow.definition?.edges?.map(toFlowEdge) ?? [];
      return newEdges.map((ne) => {
        const existing = prevEdges.find((p) => p.id === ne.id);
        if (existing) {
          return {
            ...ne,
            // Preserve execution highlights and selection
            selected: existing.selected,
            animated: existing.animated,
            style: existing.style,
          };
        }
        return ne;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.definition?.nodes, workflow.definition?.edges, agentsData?.data, toolsData?.data]);

  const activeExecutionId = useWorkflowExecutionStore((s) => s.activeExecutionId);
  const nodeStatuses = useWorkflowExecutionStore((s) => s.nodeStatuses);
  const nodeData = useWorkflowExecutionStore((s) => s.nodeData);
  const setSelectedNodeId = useWorkflowExecutionStore((s) => s.setSelectedNodeId);
  const setSelectedNodeName = useWorkflowExecutionStore((s) => s.setSelectedNodeName);

  /** Input that the node received during the last execution run */
  const editingNodeLastInput = editingNodeId
    ? ((nodeData[editingNodeId] as Record<string, unknown> | undefined)?.input as
        | Record<string, unknown>
        | undefined)
    : undefined;

  /* Selected node */
  const selectedNode = nodes.find((n) => n.selected) ?? null;

  useEffect(() => {
    setSelectedNodeId(selectedNode?.id ?? null);
    if (selectedNode) {
      const data = selectedNode.data as WorkflowNodeData;
      const name = data.customName || (i18n.language.startsWith('fr') ? data.labelFr : data.label);
      setSelectedNodeName(name);
    } else {
      setSelectedNodeName(null);
    }
  }, [
    selectedNode,
    selectedNode?.id,
    selectedNode?.data,
    i18n.language,
    setSelectedNodeId,
    setSelectedNodeName,
  ]);

  /* Execution highlights for edges */
  useEffect(() => {
    setEdges((eds) =>
      eds.map((e) => {
        const sourceStatus = nodeStatuses[e.source];
        const targetStatus = nodeStatuses[e.target];
        const isExecuting = activeExecutionId !== null;

        let stroke = 'hsl(var(--border))';
        let strokeWidth = 2;
        let animated = false;
        let opacity = 1;

        if (isExecuting) {
          if (sourceStatus === 'COMPLETED') {
            // Traversed if target also has a status (engine arrived there)
            if (targetStatus && targetStatus !== 'PENDING') {
              stroke = 'hsl(var(--primary))';
              strokeWidth = 3;
              animated = true;
              opacity = 1;
            } else {
              opacity = 0.3; // path not taken
            }
          } else {
            opacity = 0.3;
          }
        }

        return {
          ...e,
          animated,
          style: { stroke, strokeWidth, opacity },
        };
      }),
    );
  }, [nodeStatuses, activeExecutionId, setEdges]);

  /* User draws a new edge */
  const onConnect = useCallback(
    (connection: Connection) => {
      const exists = edges.some(
        (e) => e.source === connection.source && e.target === connection.target,
      );
      if (exists) return;

      const newEdge: AddEdgePayload = {
        id: uuidv4(),
        source: connection.source!,
        target: connection.target!,
      };

      addEdgeMutation.mutate(newEdge);

      setEdges((eds) => {
        // Double check to prevent duplicates in strict mode
        if (eds.some((e) => e.source === connection.source && e.target === connection.target)) {
          return eds;
        }
        return addEdge(
          {
            ...newEdge,
            type: 'workflowEdge',
            style: { stroke: 'hsl(var(--border))', strokeWidth: 2 },
          },
          eds,
        );
      });
    },
    [edges, setEdges, addEdgeMutation],
  );

  /* ─── Undo / Redo ────────────────────────────────────────────────── */
  const {
    push: pushHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useWorkflowHistory({
    onUndo: (entry) => {
      switch (entry.op) {
        case 'node_added':
          deleteNodeMutation.mutate(entry.node.id, {
            onSuccess: () => setNodes((prev) => prev.filter((n) => n.id !== entry.node.id)),
          });
          break;
        case 'node_deleted':
          addNodeMutation.mutate(entry.node, {
            onSuccess: () => {
              setNodes((prev) => [
                ...prev,
                makeFlowNode(entry.node, agentsData?.data ?? [], toolsData?.data ?? []),
              ]);
              // Restore connected edges after the node is back
              entry.connectedEdges.forEach((ep) => {
                addEdgeMutation.mutate(ep, {
                  onSuccess: () =>
                    setEdges((prev) => [
                      ...prev,
                      {
                        ...ep,
                        type: 'workflowEdge',
                        selectable: true,
                        focusable: true,
                        style: { stroke: 'hsl(var(--border))', strokeWidth: 2 },
                      },
                    ]),
                });
              });
            },
          });
          break;
        case 'node_updated':
          updateNodeMutation.mutate(
            { nodeId: entry.nodeId, node: entry.before },
            {
              onSuccess: () =>
                setNodes((prev) =>
                  prev.map((n) =>
                    n.id === entry.nodeId
                      ? makeFlowNode(
                          {
                            ...(n.data as WorkflowNodeData),
                            ...entry.before,
                            id: entry.nodeId,
                          } as AddNodePayload,
                          agentsData?.data ?? [],
                          toolsData?.data ?? [],
                        )
                      : n,
                  ),
                ),
            },
          );
          break;
        case 'edge_added':
          deleteEdgeMutation.mutate(entry.edge.id, {
            onSuccess: () => setEdges((prev) => prev.filter((e) => e.id !== entry.edge.id)),
          });
          break;
        case 'edge_deleted':
          addEdgeMutation.mutate(entry.edge, {
            onSuccess: () =>
              setEdges((prev) => [
                ...prev,
                {
                  ...entry.edge,
                  type: 'workflowEdge',
                  selectable: true,
                  focusable: true,
                  style: { stroke: 'hsl(var(--border))', strokeWidth: 2 },
                },
              ]),
          });
          break;
      }
    },
    onRedo: (entry) => {
      switch (entry.op) {
        case 'node_added':
          addNodeMutation.mutate(entry.node, {
            onSuccess: () =>
              setNodes((prev) => [
                ...prev,
                makeFlowNode(entry.node, agentsData?.data ?? [], toolsData?.data ?? []),
              ]),
          });
          break;
        case 'node_deleted':
          deleteNodeMutation.mutate(entry.node.id, {
            onSuccess: () => setNodes((prev) => prev.filter((n) => n.id !== entry.node.id)),
          });
          break;
        case 'node_updated':
          updateNodeMutation.mutate(
            { nodeId: entry.nodeId, node: entry.after },
            {
              onSuccess: () =>
                setNodes((prev) =>
                  prev.map((n) =>
                    n.id === entry.nodeId
                      ? makeFlowNode(
                          {
                            ...(n.data as WorkflowNodeData),
                            ...entry.after,
                            id: entry.nodeId,
                          } as AddNodePayload,
                          agentsData?.data ?? [],
                          toolsData?.data ?? [],
                        )
                      : n,
                  ),
                ),
            },
          );
          break;
        case 'edge_added':
          addEdgeMutation.mutate(entry.edge, {
            onSuccess: () =>
              setEdges((prev) => [
                ...prev,
                {
                  ...entry.edge,
                  type: 'workflowEdge',
                  selectable: true,
                  focusable: true,
                  style: { stroke: 'hsl(var(--border))', strokeWidth: 2 },
                },
              ]),
          });
          break;
        case 'edge_deleted':
          deleteEdgeMutation.mutate(entry.edge.id, {
            onSuccess: () => setEdges((prev) => prev.filter((e) => e.id !== entry.edge.id)),
          });
          break;
      }
    },
  });

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData('application/workflow-tool');
      if (!raw) return;
      const { toolId, toolName, category } = JSON.parse(raw) as {
        toolId: string;
        toolName: string;
        category: string;
      };
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const nodeType: NodeTypeId = category === 'MCP' ? 'MCP' : 'TOOL';
      const node: AddNodePayload = {
        id: uuidv4(),
        type: nodeType,
        customName: toolName,
        config: { toolId },
        position,
      };
      addNodeMutation.mutate(node, {
        onSuccess: () => {
          setNodes((prev) => [
            ...prev,
            makeFlowNode(node, agentsData?.data ?? [], toolsData?.data ?? []),
          ]);
          pushHistory({ op: 'node_added', node });
        },
      });
    },
    [screenToFlowPosition, addNodeMutation, agentsData, toolsData, setNodes, pushHistory],
  );

  /* Save node from dialog */
  const handleSaveNode = (node: AddNodePayload) => {
    if (editingNodeId) {
      // Capture the before-state for undo
      const existingNode = nodes.find((n) => n.id === editingNodeId);
      const existingData = existingNode?.data as WorkflowNodeData | undefined;
      const before: Partial<AddNodePayload> = {
        type: existingData?.nodeType as AddNodePayload['type'],
        customName: existingData?.customName,
        config: existingData?.config,
        position: existingNode?.position as { x: number; y: number },
      };
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
            pushHistory({ op: 'node_updated', nodeId: node.id, before, after: node });
            // User requested not to close the sidebar when updating
            // setEditorOpen(false);
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
          pushHistory({ op: 'node_added', node });
          setEditorOpen(false);

          if (splittingEdgeId) {
            const edgeToSplit = edges.find((e) => e.id === splittingEdgeId);
            if (edgeToSplit) {
              // Create exactly two new edges connecting Source->New and New->Target
              const edge1: AddEdgePayload = {
                id: uuidv4(),
                source: edgeToSplit.source,
                target: node.id,
              };
              const edge2: AddEdgePayload = {
                id: uuidv4(),
                source: node.id,
                target: edgeToSplit.target,
              };

              // Chain backend updates sequentially to prevent read-modify-write concurrency errors
              const chainMutations = async () => {
                try {
                  await deleteEdgeMutation.mutateAsync(edgeToSplit.id);
                  await addEdgeMutation.mutateAsync(edge1);
                  await addEdgeMutation.mutateAsync(edge2);
                } catch (error) {
                  console.error('Failed to complete edge splitting mutations', error);
                }
              };

              chainMutations();

              setEdges((prev) => {
                const filtered = prev.filter((e) => e.id !== splittingEdgeId);
                return [
                  ...filtered,
                  {
                    ...edge1,
                    type: 'workflowEdge',
                    style: { stroke: 'hsl(var(--border))', strokeWidth: 2 },
                  },
                  {
                    ...edge2,
                    type: 'workflowEdge',
                    style: { stroke: 'hsl(var(--border))', strokeWidth: 2 },
                  },
                ];
              });
            }
            setSplittingEdgeId(null);
          }
        },
      });
    }
  };

  const selectedData = selectedNode?.data as WorkflowNodeData | undefined;
  const selectedMeta = selectedData ? getNodeTypeMeta(selectedData.nodeType as NodeTypeId) : null;

  const selectedEdge = edges.find((e) => e.selected) ?? null;

  const handleDeleteSelected = () => {
    if (selectedNode) {
      const data = selectedNode.data as WorkflowNodeData;
      if (data?.nodeType === 'START' || data?.nodeType === 'END') return;
      const nodePayload: AddNodePayload = {
        id: selectedNode.id,
        type: data.nodeType as AddNodePayload['type'],
        customName: data.customName,
        config: data.config,
        position: selectedNode.position as { x: number; y: number },
      };
      // Capture edges connected to this node before deleting
      const connectedEdges: AddEdgePayload[] = edges
        .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
        .map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          condition: e.label as string | undefined,
        }));
      deleteNodeMutation.mutate(selectedNode.id, {
        onSuccess: () => {
          setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id));
          pushHistory({ op: 'node_deleted', node: nodePayload, connectedEdges });
        },
      });
    } else if (selectedEdge) {
      const edgePayload: AddEdgePayload = {
        id: selectedEdge.id,
        source: selectedEdge.source,
        target: selectedEdge.target,
        condition: selectedEdge.label as string | undefined,
      };
      deleteEdgeMutation.mutate(selectedEdge.id, {
        onSuccess: () => {
          setEdges((prev) => prev.filter((e) => e.id !== selectedEdge.id));
          pushHistory({ op: 'edge_deleted', edge: edgePayload });
        },
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
  const computeAvailableTypings = (nodeId: string | null): string => {
    if (!nodeId) return 'declare const data: any;\ndeclare const $: any;\n';
    const incomingEdges = edges.filter((e) => e.target === nodeId);
    const sourceNodeIds = incomingEdges.map((e) => e.source);
    const sourceNodes = nodes.filter((n) => sourceNodeIds.includes(n.id));

    let typings = '';
    const dataTypes: string[] = [];

    sourceNodes.forEach((n, idx) => {
      const config = (n.data as WorkflowNodeData)?.config;
      const nodeName =
        (n.data as WorkflowNodeData)?.customName || (n.data as WorkflowNodeData)?.label || n.id;
      if (config?.outputType) {
        typings += `// ─── Output from: "${nodeName}" ───\n`;
        const interfaceName = `NodeOutputType_${idx}`;
        typings += `type ${interfaceName} = ${config.outputType as string}\n\n`;
        dataTypes.push(interfaceName);
      }
    });

    const unionType = dataTypes.length > 0 ? dataTypes.join(' & ') : 'Record<string, unknown>';
    typings += `/** All data passed from upstream nodes */\n`;
    typings += `declare const data: ${unionType};\n`;
    typings += `/** Alias for data — use \$.field or \$['field'] */\n`;
    typings += `declare const $: ${unionType};\n`;

    return typings;
  };

  return (
    <div className="h-full w-full relative overflow-hidden bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
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
        onNodesDelete={(deletedNodes) => {
          // Cancel the edge-only flush — these edges belong to the node deletion
          if (pendingEdgeFlushTimer.current) {
            clearTimeout(pendingEdgeFlushTimer.current);
            pendingEdgeFlushTimer.current = null;
          }
          const capturedEdges = [...pendingEdgeDeletes.current];
          pendingEdgeDeletes.current = [];

          deletedNodes.forEach((node) => {
            const data = node.data as WorkflowNodeData;
            if (data?.nodeType === 'START' || data?.nodeType === 'END') return;
            const nodePayload: AddNodePayload = {
              id: node.id,
              type: data.nodeType as AddNodePayload['type'],
              customName: data.customName,
              config: data.config,
              position: node.position as { x: number; y: number },
            };
            const connectedEdges = capturedEdges.filter(
              (e) => e.source === node.id || e.target === node.id,
            );
            deleteNodeMutation.mutate(node.id, {
              onSuccess: () => {
                setNodes((prev) => prev.filter((n) => n.id !== node.id));
                pushHistory({ op: 'node_deleted', node: nodePayload, connectedEdges });
              },
            });
          });
        }}
        onEdgesDelete={(deletedEdges) => {
          deletedEdges.forEach((edge) => {
            const edgePayload: AddEdgePayload = {
              id: edge.id,
              source: edge.source,
              target: edge.target,
              condition: edge.label as string | undefined,
            };
            pendingEdgeDeletes.current.push(edgePayload);
            deleteEdgeMutation.mutate(edge.id, {
              onSuccess: () => setEdges((prev) => prev.filter((e) => e.id !== edge.id)),
            });
          });
          // Schedule flush — cancelled by onNodesDelete if a node is also being deleted
          if (pendingEdgeFlushTimer.current) clearTimeout(pendingEdgeFlushTimer.current);
          pendingEdgeFlushTimer.current = setTimeout(() => {
            pendingEdgeDeletes.current.forEach((ep) =>
              pushHistory({ op: 'edge_deleted', edge: ep }),
            );
            pendingEdgeDeletes.current = [];
            pendingEdgeFlushTimer.current = null;
          }, 0);
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        deleteKeyCode={['Delete', 'Backspace']}
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
                const flowEl = document.querySelector('.react-flow');
                if (flowEl) {
                  const rect = flowEl.getBoundingClientRect();
                  const x = rect.left + rect.width / 2;
                  const y = rect.top + rect.height / 2;
                  setNewNodePosition(screenToFlowPosition({ x, y }));
                } else {
                  setNewNodePosition({ x: 200, y: 200 });
                }
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

            {/* Undo / Redo */}
            <div className="flex gap-1 ml-1 border-l border-border/40 pl-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={undo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={redo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Panel>

        {/* Tools palette */}
        <Panel position="top-left" className="mt-40!">
          <div className="flex items-start gap-1">
            <div
              className={`bg-background/95 backdrop-blur-xl border border-border/30 rounded-lg shadow-sm overflow-hidden transition-all duration-200 ${paletteOpen ? 'w-52' : 'w-0 border-0'}`}
            >
              {paletteOpen && (
                <>
                  <div className="px-3 py-2 border-b border-border/30 flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Tools</span>
                    <Badge variant="outline" className="text-[10px] h-4 ml-auto">
                      {toolsData?.data?.length ?? 0}
                    </Badge>
                  </div>
                  <ScrollArea className="h-72">
                    <div className="p-2 space-y-2">
                      {(() => {
                        const allTools = toolsData?.data ?? [];
                        const mcpTools = allTools.filter((tl) => tl.category === 'MCP');
                        const otherTools = allTools.filter((tl) => tl.category !== 'MCP');
                        const renderTool = (tl: (typeof allTools)[0]) => {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const IconComp = tl.icon ? ((LucideIcons as any)[tl.icon] ?? Wrench) : Wrench;
                          return (
                            <div
                              key={tl.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData(
                                  'application/workflow-tool',
                                  JSON.stringify({ toolId: tl.id, toolName: tl.name, category: tl.category }),
                                );
                                e.dataTransfer.effectAllowed = 'copy';
                              }}
                              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-grab hover:bg-muted/60 active:cursor-grabbing select-none transition-colors"
                            >
                              <div className="h-5 w-5 rounded flex items-center justify-center bg-muted/50 shrink-0">
                                <IconComp className="h-3 w-3 text-primary" />
                              </div>
                              <span className="truncate flex-1 font-mono">{tl.name}</span>
                            </div>
                          );
                        };
                        return (
                          <>
                            {mcpTools.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1 px-1 mb-1">
                                  <Cpu className="h-3 w-3 text-sky-500" />
                                  <span className="text-[10px] font-medium text-sky-500 uppercase tracking-wide">MCP</span>
                                </div>
                                {mcpTools.map(renderTool)}
                              </div>
                            )}
                            {otherTools.length > 0 && (
                              <div>
                                {mcpTools.length > 0 && <div className="border-t border-border/30 my-1.5" />}
                                <div className="flex items-center gap-1 px-1 mb-1">
                                  <Wrench className="h-3 w-3 text-amber-500" />
                                  <span className="text-[10px] font-medium text-amber-500 uppercase tracking-wide">Custom</span>
                                </div>
                                {otherTools.map(renderTool)}
                              </div>
                            )}
                            {allTools.length === 0 && (
                              <p className="text-[11px] text-muted-foreground text-center py-4">No tools registered</p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </ScrollArea>
                </>
              )}
            </div>
            <button
              onClick={() => setPaletteOpen((o) => !o)}
              className="mt-1 h-6 w-5 flex items-center justify-center rounded bg-background/95 backdrop-blur-xl border border-border/30 shadow-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {paletteOpen ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
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
        onClose={() => {
          setEditorOpen(false);
          setSplittingEdgeId(null);
        }}
        onSave={handleSaveNode}
        initialNode={editingInitial}
        defaultPosition={newNodePosition}
        isSaving={addNodeMutation.isPending || updateNodeMutation.isPending}
        agents={agentsData?.data ?? []}
        tools={toolsData?.data ?? []}
        availableTypings={computeAvailableTypings(editingNodeId)}
        workflowId={workflow?.id}
        executionId={activeExecutionId}
        initialTestInput={editingNodeLastInput}
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
