'use client';

import { useCallback, useState } from 'react';
import { Terminal, FileJson, X, Workflow as WorkflowIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExecutionLogsPanel } from './ExecutionLogsPanel';
import { SubWorkflowExecutionPanel } from './SubWorkflowExecutionPanel';
import { NodeExecutionDataPanel } from './NodeExecutionDataPanel';
import { NodeTurn } from '../store/workflowExecution.store';
import { ExecutionLogLine } from '../hooks/useWorkflowLogs';

export interface WorkflowExecutionPanelProps {
  logs: ExecutionLogLine[];
  connected: boolean;
  executionStatus: string | null;
  executionId: string | null;
  subExecutionsCount: number;
  selectedNodeId: string | null;
  selectedNodeName: string | null;
  nodeStatuses: Record<string, string>;
  nodeData: Record<string, unknown>;
  nodeTurns: Record<string, NodeTurn[]>;
  isCancelling: boolean;
  onClear: () => void;
  onCancel: () => void;
  onClose: () => void;
}

export function WorkflowExecutionPanel(props: WorkflowExecutionPanelProps) {
  const {
    logs,
    connected,
    executionStatus,
    executionId,
    subExecutionsCount,
    selectedNodeId,
    selectedNodeName,
    nodeStatuses,
    nodeData,
    nodeTurns,
    isCancelling,
    onClear,
    onCancel,
    onClose,
  } = props;
  const [height, setHeight] = useState(350);

  const handleDragStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = height;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaY = startY - moveEvent.clientY;
        setHeight(Math.max(150, Math.min(window.innerHeight - 100, startHeight + deltaY)));
      };

      const handlePointerUp = () => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    },
    [height],
  );

  return (
    <div
      className="relative w-full shrink-0 shadow-xl rounded-t-xl overflow-hidden border border-border/50 bg-white/60 dark:bg-black/60 backdrop-blur-xl pointer-events-auto flex flex-col"
      style={{ height }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-[6px] cursor-row-resize z-50 bg-transparent hover:bg-primary/20 transition-colors"
        onPointerDown={handleDragStart}
      />
      <Tabs defaultValue="logs" className="flex-1 flex flex-col min-h-0 pt-1">
        <div className="flex items-center justify-between px-4 pt-2 border-b border-border/50 pb-2">
          <TabsList className="bg-background/50 backdrop-blur-sm">
            <TabsTrigger value="logs" className="gap-2 text-xs">
              <Terminal className="h-3.5 w-3.5" />
              Execution Logs
            </TabsTrigger>
            <TabsTrigger value="node-data" className="gap-2 text-xs">
              <FileJson className="h-3.5 w-3.5" />
              Node Execution Data
            </TabsTrigger>
            <TabsTrigger value="sub-workflows" className="gap-2 text-xs">
              <WorkflowIcon className="h-3.5 w-3.5 text-blue-500" />
              Sub-Workflows
              {subExecutionsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-500 text-[10px] font-mono">
                  {subExecutionsCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <TabsContent
          value="logs"
          className="flex-1 min-h-0 m-0 border-0 p-0 overflow-hidden outline-none flex flex-col"
        >
          <ExecutionLogsPanel
            logs={logs}
            connected={connected}
            executionStatus={executionStatus}
            executionId={executionId}
            onClear={onClear}
            onCancel={onCancel}
            isCancelling={isCancelling}
          />
        </TabsContent>

        <TabsContent
          value="node-data"
          className="flex-1 min-h-0 m-0 border-0 overflow-hidden outline-none flex flex-col"
        >
          <ScrollArea className="h-full">
            <NodeExecutionDataPanel
              selectedNodeId={selectedNodeId}
              selectedNodeName={selectedNodeName}
              nodeStatuses={nodeStatuses}
              nodeData={nodeData}
              nodeTurns={nodeTurns}
            />
          </ScrollArea>
        </TabsContent>

        <TabsContent
          value="sub-workflows"
          className="flex-1 min-h-0 m-0 border-0 overflow-hidden outline-none flex flex-col"
        >
          <SubWorkflowExecutionPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
