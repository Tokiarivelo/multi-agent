'use client';

import { useState } from 'react';
import { use } from 'react';
import { useWorkflow } from '@/features/workflows/hooks/useWorkflows';
import { WorkflowEditor } from '@/features/workflows/components/WorkflowEditor';
import { WorkflowCanvas } from '@/features/workflows/components/WorkflowCanvas';
import { ExecutionHistoryPanel } from '@/features/workflows/components/ExecutionHistoryPanel';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { History, ChevronDown, ChevronUp } from 'lucide-react';

export default function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: workflow, isLoading, error } = useWorkflow(id);
  const [historyOpen, setHistoryOpen] = useState(false);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-destructive">Error loading workflow</div>;
  if (!workflow) return <div>Workflow not found</div>;

  return (
    <div className="relative h-[calc(100vh-8rem)] w-full flex flex-col -m-6 p-4">
      {/* Background Canvas */}
      <div className={`absolute inset-0 z-0 transition-all duration-300 ${historyOpen ? 'bottom-80' : 'bottom-0'}`}>
        <WorkflowCanvas workflow={workflow} />
      </div>

      {/* Overlay Editor */}
      <div className="relative z-10 pointer-events-none w-full h-full flex flex-col pr-0">
        <WorkflowEditor workflow={workflow} />
      </div>

      {/* Execution History Drawer */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 bg-background border-t border-border shadow-xl transition-all duration-300 ${
          historyOpen ? 'h-80' : 'h-10'
        }`}
      >
        {/* Drawer toggle bar */}
        <button
          className="w-full h-10 flex items-center justify-between px-4 hover:bg-muted/50 transition-colors"
          onClick={() => setHistoryOpen((o) => !o)}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4" />
            Execution History
          </span>
          {historyOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>

        {/* Panel content */}
        {historyOpen && (
          <div className="px-4 pb-4 overflow-auto h-[calc(100%-2.5rem)]">
            <ExecutionHistoryPanel workflowId={id} />
          </div>
        )}
      </div>
    </div>
  );
}
