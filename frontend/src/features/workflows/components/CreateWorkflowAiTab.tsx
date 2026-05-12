'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, RefreshCw, Sparkles, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { workflowsApi, AiWorkflowResult, AiMessage } from '../api/workflows.api';
import { ModelSelector } from './ModelSelector';
import { AiMessageBubble } from './AiMessageBubble';
import { useNodePreferencesStore } from '../store/nodePreferences.store';

export interface AiTabSession {
  sessionId: string | null;
  messages: AiMessage[];
  result: AiWorkflowResult | null;
}

export const EMPTY_AI_TAB_SESSION: AiTabSession = {
  sessionId: null,
  messages: [],
  result: null,
};

interface CreateWorkflowAiTabProps {
  session: AiTabSession;
  onSessionUpdate: (session: AiTabSession) => void;
  onApply: (result: AiWorkflowResult) => void;
  onCancel: () => void;
}

const SUGGESTIONS = [
  'Automated code review and testing pipeline',
  'Daily report generation and email delivery',
  'Customer support ticket triage and routing',
  'Data transformation and validation workflow',
];

export function CreateWorkflowAiTab({
  session,
  onSessionUpdate,
  onApply,
  onCancel,
}: CreateWorkflowAiTabProps) {
  const { t } = useTranslation();
  const [modelId, setModelId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<'designing' | 'provisioning'>('designing');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { disabledNodeTypes, deletedNodeTypes } = useNodePreferencesStore();
  const excludedNodeTypes = useMemo(
    () => [...new Set([...disabledNodeTypes, ...deletedNodeTypes])],
    [disabledNodeTypes, deletedNodeTypes],
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session.messages]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || !modelId || isLoading) return;

    const userPrompt = prompt.trim();
    setPrompt('');
    setIsLoading(true);
    setLoadingPhase('designing');

    const optimisticMsg: AiMessage = {
      role: 'user',
      content: userPrompt,
      timestamp: new Date().toISOString(),
    };
    onSessionUpdate({ ...session, messages: [...session.messages, optimisticMsg] });

    const phaseTimer = setTimeout(() => setLoadingPhase('provisioning'), 4000);

    try {
      const res = await workflowsApi.generateWithAi({
        prompt: userPrompt,
        modelId,
        sessionId: session.sessionId ?? undefined,
        excludedNodeTypes: excludedNodeTypes.length > 0 ? excludedNodeTypes : undefined,
      });

      const agentCount = res.provisionedResources?.agents?.length ?? 0;
      const toolCount = res.provisionedResources?.tools?.length ?? 0;
      if (agentCount > 0 || toolCount > 0) {
        const parts = [
          agentCount > 0 && `${agentCount} agent${agentCount > 1 ? 's' : ''}`,
          toolCount > 0 && `${toolCount} tool${toolCount > 1 ? 's' : ''}`,
        ]
          .filter(Boolean)
          .join(' & ');
        toast.success(
          t('workflows.ai.provisionedToast', `Auto-created ${parts} for this workflow`),
        );
      }

      onSessionUpdate({ sessionId: res.sessionId, messages: res.history, result: res });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('workflows.ai.error'));
      onSessionUpdate({ ...session });
    } finally {
      clearTimeout(phaseTimer);
      setIsLoading(false);
      setLoadingPhase('designing');
    }
  }, [prompt, modelId, isLoading, session, onSessionUpdate, excludedNodeTypes, t]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleGenerate();
    }
  };

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="space-y-1.5">
        <Label>{t('workflows.ai.model')}</Label>
        <ModelSelector value={modelId} onChange={setModelId} disabled={isLoading} />
      </div>

      {/* Chat history */}
      <ScrollArea className="h-64 rounded-lg border border-border/50 bg-muted/10">
        <div ref={scrollRef} className="flex flex-col gap-2.5 p-3">
          {session.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 text-center gap-2">
              <p className="text-xs text-muted-foreground">{t('workflows.ai.generateHint')}</p>
              <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="text-[11px] px-2 py-1 rounded-full border border-border/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    onClick={() => setPrompt(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            session.messages.map((msg, i) => <AiMessageBubble key={i} msg={msg} />)
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5 flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {loadingPhase === 'provisioning'
                    ? t('workflows.ai.provisioning')
                    : t('workflows.ai.thinking')}
                </span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Prompt input */}
      <div className="relative">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            !modelId
              ? t('workflows.ai.selectModelFirst')
              : session.messages.length > 0
                ? t('workflows.ai.refinePrompt')
                : t('workflows.ai.generatePlaceholder')
          }
          disabled={!modelId || isLoading}
          rows={3}
          className="resize-none pr-10 text-sm"
        />
        <Button
          size="icon"
          variant="ghost"
          className="absolute bottom-2 right-2 h-7 w-7 disabled:opacity-30"
          onClick={() => void handleGenerate()}
          disabled={!prompt.trim() || !modelId || isLoading}
        >
          {isLoading ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('workflows.editor.cancel')}
        </Button>
        {session.result?.definition ? (
          <Button
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
            onClick={() => session.result && onApply(session.result)}
          >
            <CheckCheck className="h-4 w-4" />
            {t('workflows.ai.createFromThis')}
          </Button>
        ) : (
          <Button
            className="gap-2"
            onClick={() => void handleGenerate()}
            disabled={!prompt.trim() || !modelId || isLoading}
          >
            <Sparkles className="h-4 w-4" />
            {isLoading ? t('workflows.ai.generating') : t('workflows.ai.generate')}
          </Button>
        )}
      </div>
    </div>
  );
}
