"use client";

import { useWorkflow } from "@/features/workflows/hooks/useWorkflows";
import { WorkflowEditor } from "@/features/workflows/components/WorkflowEditor";
import { WorkflowCanvas } from "@/features/workflows/components/WorkflowCanvas";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { use } from "react";

export default function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: workflow, isLoading, error } = useWorkflow(id);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-destructive">Error loading workflow</div>;
  if (!workflow) return <div>Workflow not found</div>;

  return (
    <div className="space-y-6">
      <WorkflowEditor workflow={workflow} />
      <WorkflowCanvas workflow={workflow} />
    </div>
  );
}
