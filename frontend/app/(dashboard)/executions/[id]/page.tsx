"use client";

import { useExecution } from "@/features/executions/hooks/useExecutions";
import { ExecutionDetails } from "@/features/executions/components/ExecutionDetails";
import { ExecutionLogs } from "@/features/executions/components/ExecutionLogs";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { use } from "react";

export default function ExecutionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: execution, isLoading, error } = useExecution(id);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-destructive">Error loading execution</div>;
  if (!execution) return <div>Execution not found</div>;

  return (
    <div className="space-y-6">
      <ExecutionDetails execution={execution} />
      <ExecutionLogs executionId={id} />
    </div>
  );
}
