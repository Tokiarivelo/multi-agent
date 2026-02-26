'use client';

import { useWorkflow } from '@/features/workflows/hooks/useWorkflows';
import { WorkflowEditor } from '@/features/workflows/components/WorkflowEditor';
import { WorkflowCanvas } from '@/features/workflows/components/WorkflowCanvas';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { use } from 'react';

export default function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: workflow, isLoading, error } = useWorkflow(id);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-destructive">Error loading workflow</div>;
  if (!workflow) return <div>Workflow not found</div>;

  return (
    <div className="relative h-[calc(100vh-8rem)] w-full flex flex-col -m-6 p-4">
      {/* Background Canvas */}
      <div className="absolute inset-0 z-0">
        <WorkflowCanvas workflow={workflow} />
      </div>

      {/* Overlay Editor */}
      <div className="relative z-10 pointer-events-none w-full h-full flex flex-col pr-0">
        <WorkflowEditor workflow={workflow} />
      </div>
    </div>
  );
}
