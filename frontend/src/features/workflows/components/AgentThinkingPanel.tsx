'use client';

import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWorkflowExecutionStore } from '../store/workflowExecution.store';
import { Brain, ListChecks, Wrench, Clock } from 'lucide-react';

interface AgentThinkingPanelProps {
  selectedNodeId: string | null;
  selectedNodeName: string | null;
}

export function AgentThinkingPanel({
  selectedNodeId,
  selectedNodeName,
}: AgentThinkingPanelProps) {
  const { t } = useTranslation();
  const nodeThinking = useWorkflowExecutionStore((s) => s.nodeThinking);
  
  // If a node is selected, show its thinking steps. 
  // If not, show all thinking steps from all nodes merged and sorted by timestamp.
  const thinkingSteps = selectedNodeId 
    ? (nodeThinking[selectedNodeId] ?? [])
    : Object.values(nodeThinking).flat().sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">
            {selectedNodeId 
              ? `${t('workflows.logs.thinking_for')}: ${selectedNodeName || selectedNodeId}`
              : t('workflows.logs.thinking_all')}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
          {thinkingSteps.length} {t('workflows.logs.steps')}
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {thinkingSteps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
              <div className="p-3 rounded-full bg-muted/50">
                <Brain className="h-6 w-6 opacity-20" />
              </div>
              <p className="text-xs italic">{t('workflows.logs.no_thinking')}</p>
            </div>
          ) : (
            thinkingSteps.map((step, i) => (
              <div key={`${step.timestamp}-${i}`} className="relative pl-6 border-l-2 border-muted pb-2 last:pb-0">
                {/* Connector dot */}
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-background border-2 border-amber-500 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold uppercase">
                        {step.step}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(step.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  {step.thought && (
                    <div className="text-sm text-foreground leading-relaxed bg-amber-500/5 p-3 rounded-lg border border-amber-500/10 italic">
                      {step.thought}
                    </div>
                  )}

                  {step.plan && step.plan.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <ListChecks className="h-3.5 w-3.5" />
                        {t('workflows.logs.execution_plan')}
                      </div>
                      <ul className="space-y-1.5">
                        {step.plan.map((item, idx) => (
                          <li key={idx} className="text-xs flex items-start gap-2 text-muted-foreground">
                            <span className="mt-1 w-1 h-1 rounded-full bg-muted-foreground shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {step.toolCalls && step.toolCalls.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <Wrench className="h-3.5 w-3.5" />
                        {t('workflows.logs.planned_tool_calls')}
                      </div>
                      <div className="grid gap-2">
                        {step.toolCalls.map((tool, idx) => (
                          <div key={idx} className="p-2 rounded bg-muted/40 border border-border/50 text-xs font-mono">
                            <div className="text-sky-600 dark:text-sky-400 font-bold">
                              {tool.name}(
                              <span className="text-muted-foreground font-normal">
                                {JSON.stringify(tool.args).slice(0, 50)}
                                {JSON.stringify(tool.args).length > 50 ? '...' : ''}
                              </span>
                              )
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
