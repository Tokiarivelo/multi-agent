"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkflows } from "@/features/workflows/hooks/useWorkflows";
import { useAgents } from "@/features/agents/hooks/useAgents";
import { useExecutions } from "@/features/executions/hooks/useExecutions";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Workflow, Bot, PlayCircle, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { data: workflowsData, isLoading: workflowsLoading } = useWorkflows(1, 5);
  const { data: agentsData, isLoading: agentsLoading } = useAgents(1, 5);
  const { data: executionsData, isLoading: executionsLoading } = useExecutions(1, 5);

  const isLoading = workflowsLoading || agentsLoading || executionsLoading;

  if (isLoading) return <LoadingSpinner />;

  const workflows = workflowsData?.data || [];
  const agents = agentsData?.data || [];
  const executions = executionsData?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your multi-agent system</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workflows</CardTitle>
            <Workflow className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workflowsData?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {workflows.filter(w => w.status === 'active').length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agents</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agentsData?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {agents.filter(a => a.status === 'active').length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Executions</CardTitle>
            <PlayCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{executionsData?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {executions.filter(e => e.status === 'running').length} running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {executions.filter(e => e.status === 'completed').length}
            </div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Workflows</CardTitle>
            <CardDescription>Latest workflow configurations</CardDescription>
          </CardHeader>
          <CardContent>
            {workflows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No workflows yet</p>
            ) : (
              <div className="space-y-4">
                {workflows.slice(0, 5).map((workflow) => (
                  <Link
                    key={workflow.id}
                    href={`/workflows/${workflow.id}`}
                    className="flex items-center justify-between hover:bg-gray-50 p-2 rounded-md transition-colors"
                  >
                    <div>
                      <p className="font-medium">{workflow.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {workflow.nodes?.length || 0} nodes
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {workflow.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Executions</CardTitle>
            <CardDescription>Latest execution results</CardDescription>
          </CardHeader>
          <CardContent>
            {executions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No executions yet</p>
            ) : (
              <div className="space-y-4">
                {executions.slice(0, 5).map((execution) => (
                  <Link
                    key={execution.id}
                    href={`/executions/${execution.id}`}
                    className="flex items-center justify-between hover:bg-gray-50 p-2 rounded-md transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{execution.id.slice(0, 12)}...</p>
                      <p className="text-xs text-muted-foreground">
                        {execution.workflow?.name || 'Unknown workflow'}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {execution.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
