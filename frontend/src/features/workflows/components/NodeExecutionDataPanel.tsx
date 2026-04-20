'use client';

import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NodeTurn } from '../store/workflowExecution.store';
import { MultiTurnTimeline } from './MultiTurnTimeline';
import { SingleTurnView } from './SingleTurnView';

export interface NodeExecutionDataPanelProps {
  selectedNodeId: string | null;
  selectedNodeName: string | null;
  nodeStatuses: Record<string, string>;
  nodeData: Record<string, unknown>;
  nodeTurns: Record<string, NodeTurn[]>;
}

export function NodeExecutionDataPanel({
  selectedNodeId,
  selectedNodeName,
  nodeStatuses,
  nodeData,
  nodeTurns,
}: NodeExecutionDataPanelProps) {
  const { t } = useTranslation();

  if (!selectedNodeId) {
    return (
      <div className="flex h-full items-center justify-center min-h-[120px] text-sm text-muted-foreground italic p-4">
        {t('workflows.editor.selectNodeMsg', 'Select a node on the canvas to view its execution data.')}
      </div>
    );
  }

  if (!nodeStatuses[selectedNodeId]) {
    return (
      <div className="flex h-full items-center justify-center min-h-[120px] text-sm text-muted-foreground p-4">
        {selectedNodeName ? `Node '${selectedNodeName}'` : 'Node'} [{selectedNodeId}] has not executed yet.
      </div>
    );
  }

  const turns = nodeTurns[selectedNodeId] ?? [];
  const hasInteraction = turns.some((turn) => turn.status === 'WAITING_INPUT');

  if (hasInteraction && turns.length > 1) {
    return (
      <MultiTurnTimeline
        selectedNodeId={selectedNodeId}
        selectedNodeName={selectedNodeName}
        turns={turns}
        nodeStatus={nodeStatuses[selectedNodeId]}
      />
    );
  }

  return (
    <SingleTurnView
      selectedNodeId={selectedNodeId}
      selectedNodeName={selectedNodeName}
      nodeStatus={nodeStatuses[selectedNodeId]}
      raw={nodeData[selectedNodeId] as Record<string, unknown> | undefined}
    />
  );
}
