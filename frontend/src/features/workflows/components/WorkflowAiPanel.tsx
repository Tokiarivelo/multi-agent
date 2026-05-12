'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Send, X, RefreshCw, CheckCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Workflow } from '@/types';
import { workflowsApi, AiMessage, AiWorkflowResult } from '../api/workflows.api';
import { ModelSelector } from './ModelSelector';
import { useNodePreferencesStore } from '../store/nodePreferences.store';
import { AiMessageBubble } from './AiMessageBubble';

interface WorkflowAiPanelProps {
  workflow?: Workflow;
  isOpen: boolean;
  onClose: () => void;
  onApplyDefinition: (
    definition: Workflow['definition'],
    name?: string,
    description?: string,
  ) => void;
}

interface LocalSession {
  sessionId: string | null;
  messages: AiMessage[];
  lastResult: AiWorkflowResult | null;
}

const EMPTY_SESSION: LocalSession = {
  sessionId: null,
  messages: [],
  lastResult: null,
};

export function WorkflowAiPanel({
  workflow,
  isOpen,
  onClose,
  onApplyDefinition,
}: WorkflowAiPanelProps) {
  const { t } = useTranslation();
  const [session, setSession] = useState<LocalSession>(EMPTY_SESSION);
  const [modelId, setModelId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { disabledNodeTypes, deletedNodeTypes } = useNodePreferencesStore();
  const excludedNodeTypes = useMemo(
    () => [...new Set([...disabledNodeTypes, ...deletedNodeTypes])],
    [disabledNodeTypes, deletedNodeTypes],
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lastResult = session.lastResult;
  const hasDefinition = !!lastResult?.definition;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session.messages]);

  useEffect(() => {
    if (isOpen) setTimeout(() => textareaRef.current?.focus(), 100);
  }, [isOpen]);

  const handleSend = useCallback(async () => {
    if (!prompt.trim() || !modelId || isLoading) return;

    const userPrompt = prompt.trim();
    setPrompt('');
    setIsLoading(true);

    setSession((prev) => ({
      ...prev,
      messages: [
        ...prev.messages,
        { role: 'user', content: userPrompt, timestamp: new Date().toISOString() },
      ],
    }));

    try {
      let result: AiWorkflowResult;

      if (workflow?.id) {
        result = await workflowsApi.editWithAi(workflow.id, {
          prompt: userPrompt,
          modelId,
          sessionId: session.sessionId ?? undefined,
          excludedNodeTypes: excludedNodeTypes.length > 0 ? excludedNodeTypes : undefined,
        });
      } else {
        result = await workflowsApi.generateWithAi({
          prompt: userPrompt,
          modelId,
          sessionId: session.sessionId ?? undefined,
          excludedNodeTypes: excludedNodeTypes.length > 0 ? excludedNodeTypes : undefined,
        });
      }

      setSession({
        sessionId: result.sessionId,
        messages: result.history,
        lastResult: result,
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('workflows.ai.error', 'AI request failed'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [prompt, modelId, isLoading, workflow, session.sessionId, excludedNodeTypes, t]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApply = () => {
    if (!lastResult?.definition) return;
    onApplyDefinition(lastResult.definition, lastResult.name, lastResult.description);
    toast.success(t('workflows.ai.applied', 'AI changes applied to workflow'));
  };

  const handleClearSession = useCallback(async () => {
    if (session.sessionId) {
      try {
        await workflowsApi.deleteAiSession(session.sessionId);
      } catch {
        /* best effort */
      }
    }
    setSession(EMPTY_SESSION);
    setPrompt('');
  }, [session.sessionId]);

  if (!isOpen) return null;

  return (
    <div className="w-100 h-full flex flex-col gap-0 pointer-events-auto overflow-hidden rounded-xl border border-border/50 shadow-xl backdrop-blur-xl bg-white/40 dark:bg-black/40">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-violet-500/10">
            <Bot className="h-4 w-4 text-violet-500" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">
              {t('workflows.ai.panelTitle', 'AI Assistant')}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {workflow
                ? t('workflows.ai.editMode', 'Editing workflow')
                : t('workflows.ai.generateMode', 'Generate workflow')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {session.messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={handleClearSession}
              title={t('workflows.ai.clearSession', 'Clear session')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Model selector */}
      <div className="px-4 py-2.5 border-b border-border/30 shrink-0 bg-muted/20">
        <ModelSelector
          value={modelId}
          onChange={setModelId}
          disabled={isLoading}
          className="h-8 text-xs"
        />
        {session.sessionId && (
          <p className="text-[9px] text-muted-foreground mt-1 font-mono truncate">
            Session: {session.sessionId}
          </p>
        )}
      </div>

      {/* Chat history */}
      <ScrollArea className="flex-1 min-h-0">
        <div ref={scrollRef} className="flex flex-col gap-3 p-4">
          {session.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center gap-2">
              <Bot className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {workflow
                  ? t(
                      'workflows.ai.editHint',
                      'Describe the changes you want to make to this workflow.',
                    )
                  : t('workflows.ai.generateHint', 'Describe the workflow you want to create.')}
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                {(workflow
                  ? [
                      'Add a notification step at the end',
                      'Add error handling with retry logic',
                      'Insert a data validation step',
                    ]
                  : [
                      'Automated code review pipeline',
                      'Daily report generation workflow',
                      'Customer support triage flow',
                    ]
                ).map((suggestion) => (
                  <button
                    key={suggestion}
                    className="text-[11px] px-2 py-1 rounded-full border border-border/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    onClick={() => setPrompt(suggestion)}
                  >
                    {suggestion}
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
                  {t('workflows.ai.thinking', 'Thinking…')}
                </span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Apply button (shown when there's a pending definition) */}
      {hasDefinition && (
        <div className="px-4 py-2 border-t border-border/30 shrink-0 bg-violet-500/5">
          <Button
            className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white"
            onClick={handleApply}
            disabled={isLoading}
          >
            <CheckCheck className="h-4 w-4" />
            {t('workflows.ai.applyChanges', 'Apply to Workflow')}
          </Button>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 pb-4 pt-2 border-t border-border/30 shrink-0">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !modelId
                ? t('workflows.ai.selectModelFirst', 'Select a model first…')
                : workflow
                  ? t('workflows.ai.editPlaceholder', 'Describe the changes you want…')
                  : t(
                      'workflows.ai.generatePlaceholder',
                      'Describe the workflow you want to create…',
                    )
            }
            disabled={!modelId || isLoading}
            rows={3}
            className="resize-none pr-10 text-sm"
          />
          <Button
            size="icon"
            variant="ghost"
            className="absolute bottom-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
            onClick={handleSend}
            disabled={!prompt.trim() || !modelId || isLoading}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          {t('workflows.ai.enterHint', 'Enter to send · Shift+Enter for new line')}
        </p>
      </div>
    </div>
  );
}
