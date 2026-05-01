'use client';

import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useModels } from '@/features/models/hooks/useModels';
import { useAgents } from '@/features/agents/hooks/useAgents';
import { ChatSession, CreateSessionInput } from '../api/chat.api';
import { useUpdateChatSession } from '../hooks/useChatSessions';

interface Props {
  session: ChatSession;
}

const NONE = '__none__';

export function ChatConfigBar({ session }: Props) {
  const { t } = useTranslation();
  const { data: modelsData } = useModels(1, 100);
  const { data: agentsData } = useAgents(1, 100);
  const updateSession = useUpdateChatSession();

  const models = modelsData?.data ?? [];
  const agents = agentsData?.data ?? [];

  const patch = (input: Partial<CreateSessionInput>) => {
    updateSession.mutate({ id: session.id, input });
  };

  return (
    <div className="flex items-center gap-2 border-b border-border/50 bg-card px-4 py-2">
      <span className="text-xs text-muted-foreground shrink-0">{t('chat.config.agent')}:</span>
      <Select
        value={session.agentId ?? NONE}
        onValueChange={(v) => patch({ agentId: v === NONE ? undefined : v, modelId: undefined })}
      >
        <SelectTrigger className="h-7 text-xs w-44">
          <SelectValue placeholder={t('chat.config.select_agent')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t('chat.config.none')}</SelectItem>
          {agents.map((a) => (
            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!session.agentId && (
        <>
          <span className="text-xs text-muted-foreground shrink-0">{t('chat.config.model')}:</span>
          <Select
            value={session.modelId ?? NONE}
            onValueChange={(v) => patch({ modelId: v === NONE ? undefined : v })}
          >
            <SelectTrigger className="h-7 text-xs w-48">
              <SelectValue placeholder={t('chat.config.select_model')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t('chat.config.none')}</SelectItem>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
    </div>
  );
}
