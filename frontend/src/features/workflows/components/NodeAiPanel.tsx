'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Send, CheckCheck, X, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ModelSelector } from './ModelSelector';
import { workflowsApi, AiMessage, NodeAiResult } from '../api/workflows.api';
import { toast } from 'sonner';

interface NodeAiPanelProps {
  nodeType: string;
  config: Record<string, unknown>;
  customName: string;
  onApply: (config: Record<string, unknown>, customName?: string) => void;
  onApplyDirectly?: (config: Record<string, unknown>, customName?: string) => void;
  onClose: () => void;
  executionData?: {
    input?: unknown;
    output?: unknown;
    logs?: string[];
    error?: string;
  };
}

export function NodeAiPanel({
  nodeType,
  config,
  customName,
  onApply,
  onApplyDirectly,
  onClose,
  executionData,
}: NodeAiPanelProps) {
  const { t } = useTranslation();

  const [modelId, setModelId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [pendingResult, setPendingResult] = useState<NodeAiResult | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || !modelId || loading) return;

    setLoading(true);
    setPrompt('');

    try {
      const result = await workflowsApi.editNodeWithAi({
        nodeType,
        nodeConfig: config,
        customName: customName || undefined,
        prompt: trimmed,
        modelId,
        sessionId,
        executionLogs: executionData?.logs,
        executionOutput: executionData?.output,
        executionInput: executionData?.input,
        executionError: executionData?.error,
      });

      setSessionId(result.sessionId);
      setMessages(result.history);

      const hasChanges =
        result.config && Object.keys(result.config).length > 0;
      if (hasChanges || result.customName) {
        setPendingResult(result);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('workflows.nodeAi.error', 'AI request failed'));
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleApply = () => {
    if (!pendingResult) return;
    const merged = { ...config, ...(pendingResult.config ?? {}) };
    onApply(merged, pendingResult.customName);
    setPendingResult(null);
    toast.success(t('workflows.nodeAi.applied', 'Node config updated'));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-card/95 backdrop-blur-xl border-l border-border/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-semibold">
            {t('workflows.nodeAi.title', 'AI Edit Node')}
          </span>
          <span className="text-xs text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
            {nodeType}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Model selector */}
      <div className="px-4 py-2 border-b border-border/30 shrink-0">
        <ModelSelector
          value={modelId}
          onChange={setModelId}
          placeholder={t('workflows.nodeAi.selectModel', 'Choose a model…')}
          className="h-8 text-xs"
        />
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground">
            <Bot className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-xs">
              {t('workflows.nodeAi.hint', 'Describe the changes you want. E.g. "Add a strict mode check for the output field"')}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'mb-3 max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed',
              msg.role === 'user'
                ? 'ml-auto bg-primary text-primary-foreground'
                : 'mr-auto bg-muted/70 text-foreground border border-border/30',
            )}
          >
            {msg.role === 'assistant' ? (
              <AssistantMessage content={msg.content} />
            ) : (
              <span className="whitespace-pre-wrap">{getDisplayContent(msg.content)}</span>
            )}
          </div>
        ))}

        {loading && (
          <div className="mr-auto bg-muted/70 rounded-xl px-3 py-2 flex items-center gap-1.5 text-xs text-muted-foreground border border-border/30">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('workflows.nodeAi.thinking', 'Thinking…')}
          </div>
        )}

        <div ref={bottomRef} />
      </ScrollArea>

      {/* Apply banner */}
      {pendingResult && (
        <div className="mx-3 mb-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
          <p className="text-xs text-violet-700 dark:text-violet-300 flex-1 line-clamp-2">
            {pendingResult.customName
              ? t('workflows.nodeAi.pendingWithName', 'Config + name changes ready')
              : t('workflows.nodeAi.pending', 'Config changes ready to apply')}
          </p>
          <Button size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={handleApply}>
            <CheckCheck className="h-3.5 w-3.5" />
            {t('workflows.nodeAi.apply', 'Apply')}
          </Button>
          {onApplyDirectly && (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs gap-1 shrink-0 bg-violet-600 hover:bg-violet-700 text-white"
              onClick={() => {
                if (!pendingResult) return;
                const merged = { ...config, ...(pendingResult.config ?? {}) };
                onApplyDirectly(merged, pendingResult.customName);
                setPendingResult(null);
                toast.success(t('workflows.nodeAi.appliedDirectly', 'Node updated directly'));
              }}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {t('workflows.nodeAi.applyAndSave', 'Apply & Save')}
            </Button>
          )}
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 shrink-0">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              modelId
                ? t('workflows.nodeAi.placeholder', 'Describe what to change… (Enter to send)')
                : t('workflows.nodeAi.selectModelFirst', 'Select a model first…')
            }
            disabled={!modelId || loading}
            rows={3}
            className="resize-none pr-10 text-xs"
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 bottom-2 h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={handleSend}
            disabled={!prompt.trim() || !modelId || loading}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Renders the assistant message — shows the human-readable "message" field, not raw JSON */
function AssistantMessage({ content }: { content: string }) {
  const parsed = tryParseJson(content);
  const msg = typeof parsed?.message === 'string' ? parsed.message : null;
  if (msg) {
    return <span className="whitespace-pre-wrap">{msg}</span>;
  }
  return <span className="whitespace-pre-wrap">{content}</span>;
}

/** Strips the context prefix injected by the service so the user sees only their original text */
function getDisplayContent(content: string): string {
  const idx = content.indexOf('\n\nUser request: ');
  return idx >= 0 ? content.slice(idx + '\n\nUser request: '.length) : content;
}

function tryParseJson(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}
