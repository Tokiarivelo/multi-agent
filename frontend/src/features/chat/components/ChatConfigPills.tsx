'use client';

import { useTranslation } from 'react-i18next';
import { ChevronDown, Cpu, Bot, Check } from 'lucide-react';
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
import { ChatSession, CreateSessionInput } from '../api/chat.api';
import { useUpdateChatSession } from '../hooks/useChatSessions';
import { cn } from '@/lib/utils';

interface PillProps {
  icon: React.ElementType;
  label: string;
  active: boolean;
  children: React.ReactNode;
}

function SelectorPill({ icon: Icon, label, active, children }: PillProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
            'border outline-none focus-visible:ring-1 focus-visible:ring-primary/50',
            active
              ? 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/15'
              : 'bg-muted/40 border-border/40 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border/70',
          )}
        >
          <Icon className="h-3 w-3 shrink-0" />
          <span className="max-w-[120px] truncate">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      {children}
    </DropdownMenu>
  );
}

interface Props {
  session: ChatSession;
}

export function ChatConfigPills({ session }: Props) {
  const { t } = useTranslation();
  const { data: modelsData } = useModels(1, 100);
  const { data: agentsData } = useAgents(1, 100);
  const updateSession = useUpdateChatSession();

  const models = modelsData?.data ?? [];
  const agents = agentsData?.data ?? [];
  const currentModel = models.find((m) => m.id === session.modelId);
  const currentAgent = agents.find((a) => a.id === session.agentId);

  const patch = (input: Partial<CreateSessionInput>) =>
    updateSession.mutate({ id: session.id, input });

  return (
    <div className="flex items-center gap-1.5">
      <SelectorPill icon={Bot} label={currentAgent?.name ?? t('chat.config.agent')} active={!!session.agentId}>
        <DropdownMenuContent align="start" side="top" className="w-56 max-h-64 overflow-y-auto">
          <DropdownMenuLabel className="text-xs text-muted-foreground">{t('chat.config.agent')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => patch({ agentId: undefined })} className="text-muted-foreground">
            {t('chat.config.none')}
          </DropdownMenuItem>
          {agents.map((a) => (
            <DropdownMenuItem key={a.id} onClick={() => patch({ agentId: a.id, modelId: undefined })}>
              <span className="flex-1">{a.name}</span>
              {session.agentId === a.id && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </SelectorPill>

      {!session.agentId && (
        <SelectorPill icon={Cpu} label={currentModel?.name ?? t('chat.config.model')} active={!!session.modelId}>
          <DropdownMenuContent align="start" side="top" className="w-60 max-h-64 overflow-y-auto">
            <DropdownMenuLabel className="text-xs text-muted-foreground">{t('chat.config.model')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => patch({ modelId: undefined })} className="text-muted-foreground">
              {t('chat.config.none')}
            </DropdownMenuItem>
            {models.map((m) => (
              <DropdownMenuItem key={m.id} onClick={() => patch({ modelId: m.id })}>
                <div className="flex flex-col flex-1">
                  <span>{m.name}</span>
                  <span className="text-[10px] text-muted-foreground">{m.provider}</span>
                </div>
                {session.modelId === m.id && <Check className="h-3.5 w-3.5 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </SelectorPill>
      )}
    </div>
  );
}
