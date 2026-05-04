'use client';

import { useTranslation } from 'react-i18next';
import { ChevronDown, Cpu, Bot, Check, GitBranch, X, Settings2, Wrench, Zap } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useModels } from '@/features/models/hooks/useModels';
import { useAgents } from '@/features/agents/hooks/useAgents';
import { useWorkflows } from '@/features/workflows/hooks/useWorkflows';
import { useTools } from '@/features/tools/hooks/useTools';
import { Model } from '@/types';
import { ChatSession, CreateSessionInput } from '../api/chat.api';
import { useUpdateChatSession } from '../hooks/useChatSessions';
import { useChatStore } from '../store/chat.store';
import { cn } from '@/lib/utils';

interface Props {
  session: ChatSession;
}

const pillBase =
  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border outline-none focus-visible:ring-1 focus-visible:ring-primary/50';
const pillActive = 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/15';
const pillIdle =
  'bg-muted/40 border-border/40 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border/70';

function fmtTokens(n: number): string {
  return n >= 1_000_000 ? `${Math.round(n / 1_000_000)}M` : `${Math.round(n / 1000)}k`;
}

function ModelItem({ model, selected }: { model: Model; selected: boolean }) {
  const isAvailable = model.isActive && model.status !== 'unavailable';
  return (
    <>
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', isAvailable ? 'bg-green-500' : 'bg-muted-foreground/40')} />
      <div className="flex flex-col flex-1 min-w-0">
        <span className="truncate">{model.name}</span>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
          {model.provider}
          {model.maxTokens && <span className="opacity-70">· {fmtTokens(model.maxTokens)}</span>}
          {model.supportsStreaming && <span className="opacity-70">· stream</span>}
        </span>
      </div>
      {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
    </>
  );
}

export function ChatConfigPills({ session }: Props) {
  const { t } = useTranslation();
  const { data: modelsData } = useModels(1, 100);
  const { data: agentsData } = useAgents(1, 100);
  const { data: workflowsData } = useWorkflows(1, 100);
  const { data: toolsData } = useTools(1, 100);
  const updateSession = useUpdateChatSession();
  const autoActivateTools = useChatStore((s) => s.autoActivateTools);

  const models = modelsData?.data ?? [];
  const agents = agentsData?.data ?? [];
  const workflows = workflowsData?.data ?? [];
  const tools = toolsData?.data ?? [];

  const currentModel = models.find((m) => m.id === session.modelId);
  const currentAgent = agents.find((a) => a.id === session.agentId);
  const currentWorkflow = workflows.find((w) => w.id === session.workflowId);

  const patch = (input: Partial<CreateSessionInput>) =>
    updateSession.mutate({ id: session.id, input });

  const hasSelection = !!(session.agentId || session.workflowId || session.modelId);
  const primaryLabel =
    currentAgent?.name ?? currentWorkflow?.name ?? currentModel?.name ?? t('chat.config.configure');
  const PrimaryIcon = currentAgent ? Bot : currentWorkflow ? GitBranch : currentModel ? Cpu : Settings2;

  const clearConfig = (e: React.MouseEvent) => {
    e.stopPropagation();
    patch({ agentId: null, workflowId: null, modelId: null });
  };

  const toggleTool = (e: React.MouseEvent, toolId: string) => {
    e.preventDefault();
    const current = session.tools ?? [];
    const next = current.includes(toolId) ? current.filter((id) => id !== toolId) : [...current, toolId];
    patch({ tools: next });
  };

  const toolCount = session.tools?.length ?? 0;
  const toolsLabel = autoActivateTools
    ? t('chat.config.tools_auto')
    : toolCount > 0
      ? t('chat.config.tools_count', { count: toolCount })
      : t('chat.config.tools');

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(pillBase, hasSelection ? pillActive : pillIdle)}>
            <PrimaryIcon className="h-3 w-3 shrink-0" />
            <span className="max-w-[120px] truncate">{primaryLabel}</span>
            {hasSelection ? (
              <span
                role="button"
                tabIndex={-1}
                onClick={clearConfig}
                className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </span>
            ) : (
              <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" side="top" className="w-64 max-h-80 overflow-y-auto">
          <DropdownMenuLabel className="text-xs text-muted-foreground">{t('chat.config.agent')}</DropdownMenuLabel>
          {agents.map((a) => (
            <DropdownMenuItem
              key={a.id}
              onClick={() => patch({ agentId: a.id === session.agentId ? null : a.id, modelId: null })}
            >
              <Bot className="h-3.5 w-3.5 mr-2 shrink-0 text-muted-foreground" />
              <span className="flex-1">{a.name}</span>
              {session.agentId === a.id && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuLabel className="text-xs text-muted-foreground">{t('chat.config.workflow')}</DropdownMenuLabel>
          {workflows.map((w) => (
            <DropdownMenuItem
              key={w.id}
              onClick={() => patch({ workflowId: w.id === session.workflowId ? null : w.id })}
            >
              <GitBranch className="h-3.5 w-3.5 mr-2 shrink-0 text-muted-foreground" />
              <span className="flex-1">{w.name}</span>
              {session.workflowId === w.id && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}

          {!session.agentId && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">{t('chat.config.model')}</DropdownMenuLabel>
              {models.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  onClick={() => patch({ modelId: m.id === session.modelId ? null : m.id })}
                  className="gap-2"
                >
                  <ModelItem model={m} selected={session.modelId === m.id} />
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {!session.agentId && session.modelId && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(pillBase, toolCount > 0 || autoActivateTools ? pillActive : pillIdle)}>
              {autoActivateTools ? <Zap className="h-3 w-3 shrink-0" /> : <Wrench className="h-3 w-3 shrink-0" />}
              <span className="max-w-[100px] truncate">{toolsLabel}</span>
              {toolCount > 0 && !autoActivateTools ? (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => { e.stopPropagation(); patch({ tools: [] }); }}
                  className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 transition-colors"
                >
                  <X className="h-2.5 w-2.5" />
                </span>
              ) : (
                <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-60 max-h-64 overflow-y-auto">
            <DropdownMenuLabel className="text-xs text-muted-foreground">{t('chat.config.tools')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {tools.map((tool) => (
              <DropdownMenuItem key={tool.id} onClick={(e) => toggleTool(e, tool.id)} className="gap-2 items-start">
                <Wrench className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="truncate font-medium">{tool.name}</span>
                  {tool.description && (
                    <span className="text-[10px] text-muted-foreground line-clamp-2 leading-snug">
                      {tool.description}
                    </span>
                  )}
                </div>
                {session.tools?.includes(tool.id) && <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
