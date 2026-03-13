'use client';

import { useWorkflows } from '@/features/workflows/hooks/useWorkflows';
import { useAgents } from '@/features/agents/hooks/useAgents';
import { useExecutions } from '@/features/executions/hooks/useExecutions';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Sparkles } from 'lucide-react';
import { DashboardStats } from './DashboardStats';
import { RecentWorkflows } from './RecentWorkflows';
import { RecentExecutions } from './RecentExecutions';
import { Execution, Workflow, Agent } from '@/types';

export function DashboardOverview() {
  const { t } = useTranslation();
  const { data: workflowsData, isLoading: workflowsLoading } = useWorkflows(1, 5);
  const { data: agentsData, isLoading: agentsLoading } = useAgents(1, 5);
  const { data: executionsData, isLoading: executionsLoading } = useExecutions(1, 5);

  const isLoading = workflowsLoading || agentsLoading || executionsLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <LoadingSpinner className="h-12 w-12 text-violet-500" />
        <p className="mt-4 text-sm font-medium text-muted-foreground animate-pulse">
          {t('workflows.logs.waiting')}
        </p>
      </div>
    );
  }

  const workflows = workflowsData?.data || [];
  const agents = agentsData?.data || [];
  const executions = executionsData?.data || [];

  const stats = {
    workflows: {
      total: workflowsData?.total || 0,
      active: workflows.filter((w: Workflow) => w.status === 'active' || w.status === 'ACTIVE').length,
    },
    agents: {
      total: agentsData?.total || 0,
      active: agents.filter((a: Agent) => a.status === 'active').length,
    },
    executions: {
      total: executionsData?.total || 0,
      running: executions.filter((e: Execution) => e.status === 'running').length,
    },
    completed: {
      total: executions.filter((e: Execution) => e.status === 'completed').length,
    },
  };

  return (
    <div className="space-y-10 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <LayoutDashboard className="h-10 w-10 text-violet-500" />
            {t('dashboard.title')}
          </h1>
          <p className="text-muted-foreground font-medium text-lg pl-1">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-violet-500/10 text-violet-600 px-4 py-2 rounded-2xl border border-violet-500/20 text-sm font-bold shadow-xs">
          <Sparkles className="h-4 w-4" />
          System Active
        </div>
      </div>

      <DashboardStats stats={stats} />

      <div className="grid gap-8 md:grid-cols-2">
        <RecentWorkflows workflows={workflows} />
        <RecentExecutions executions={executions} />
      </div>
    </div>
  );
}
