import { useState } from 'react';
import { agentsApi } from '@/features/agents/api/agents.api';
import { workflowsApi } from '@/features/workflows/api/workflows.api';
import { WorkflowNode } from '@/types';

export interface DependencyItem {
  id: string;
  name: string;
  type: 'agent' | 'workflow' | 'tool' | 'model';
  href: string;
}

export type DeleteGuardEntityType = 'tool' | 'agent' | 'model' | 'workflow' | 'apiKey';

async function fetchToolDependencies(toolId: string): Promise<DependencyItem[]> {
  const [agentsRes, workflowsRes] = await Promise.all([
    agentsApi.getAll(1, 1000),
    workflowsApi.getAll(1, 1000),
  ]);

  const deps: DependencyItem[] = [];

  for (const agent of agentsRes.data) {
    if (agent.tools?.includes(toolId)) {
      deps.push({ id: agent.id, name: agent.name, type: 'agent', href: `/agents/${agent.id}` });
    }
  }

  for (const workflow of workflowsRes.data) {
    const nodes: WorkflowNode[] = workflow.definition?.nodes ?? [];
    if (nodes.some((n) => n.data?.toolId === toolId)) {
      deps.push({ id: workflow.id, name: workflow.name, type: 'workflow', href: `/workflows/${workflow.id}` });
    }
  }

  return deps;
}

async function fetchAgentDependencies(agentId: string): Promise<DependencyItem[]> {
  const workflowsRes = await workflowsApi.getAll(1, 1000);
  const deps: DependencyItem[] = [];

  for (const workflow of workflowsRes.data) {
    const nodes: WorkflowNode[] = workflow.definition?.nodes ?? [];
    if (nodes.some((n) => n.data?.agentId === agentId)) {
      deps.push({ id: workflow.id, name: workflow.name, type: 'workflow', href: `/workflows/${workflow.id}` });
    }
  }

  return deps;
}

async function fetchWorkflowDependencies(workflowId: string): Promise<DependencyItem[]> {
  const workflowsRes = await workflowsApi.getAll(1, 1000);
  const deps: DependencyItem[] = [];

  for (const workflow of workflowsRes.data) {
    const nodes: WorkflowNode[] = workflow.definition?.nodes ?? [];
    if (nodes.some((n) => n.data?.workflowId === workflowId)) {
      deps.push({ id: workflow.id, name: workflow.name, type: 'workflow', href: `/workflows/${workflow.id}` });
    }
  }

  return deps;
}

async function fetchModelDependencies(modelId: string): Promise<DependencyItem[]> {
  const agentsRes = await agentsApi.getAll(1, 1000);
  return agentsRes.data
    .filter((a) => a.modelId === modelId)
    .map((a) => ({ id: a.id, name: a.name, type: 'agent' as const, href: `/agents/${a.id}` }));
}

async function fetchDependencies(
  type: DeleteGuardEntityType,
  entityId: string,
): Promise<DependencyItem[]> {
  switch (type) {
    case 'tool':
      return fetchToolDependencies(entityId);
    case 'agent':
      return fetchAgentDependencies(entityId);
    case 'model':
      return fetchModelDependencies(entityId);
    case 'workflow':
      return fetchWorkflowDependencies(entityId);
    case 'apiKey':
      return [];
  }
}

export function useDeleteGuard(type: DeleteGuardEntityType) {
  const [isChecking, setIsChecking] = useState(false);
  const [dependencies, setDependencies] = useState<DependencyItem[] | null>(null);
  const [open, setOpen] = useState(false);

  const openGuard = async (entityId: string) => {
    setIsChecking(true);
    setOpen(true);
    try {
      const deps = await fetchDependencies(type, entityId);
      setDependencies(deps);
    } catch {
      setDependencies([]);
    } finally {
      setIsChecking(false);
    }
  };

  const close = () => {
    setOpen(false);
    setDependencies(null);
  };

  return { open, isChecking, dependencies, openGuard, close };
}
