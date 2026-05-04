'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wrench, Send, AlertCircle, Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolRequest, useChatStore } from '../store/chat.store';

interface Props {
  request: ToolRequest;
  onAnswer: (selectedToolIds: string[]) => void;
}

export function ChatToolRequest({ request, onAnswer }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>([]);
  const [autoActivate, setAutoActivate] = useState(false);
  const setAutoActivateTools = useChatStore((s) => s.setAutoActivateTools);

  const isSuggestion = !request.failedToolName;

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const byCategory = request.availableTools.reduce<Record<string, typeof request.availableTools>>(
    (acc, tool) => {
      const cat = tool.category || 'Other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat]!.push(tool);
      return acc;
    },
    {},
  );

  return (
    <div className={cn(
      'mx-4 mb-4 rounded-2xl border p-4 space-y-3',
      isSuggestion
        ? 'border-primary/20 bg-primary/5'
        : 'border-destructive/20 bg-destructive/5',
    )}>
      <div className={cn(
        'flex items-center gap-2 text-xs font-medium',
        isSuggestion ? 'text-primary' : 'text-destructive',
      )}>
        {isSuggestion ? <Sparkles className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
        <span>{t(isSuggestion ? 'chat.tool_request.suggest_title' : 'chat.tool_request.title')}</span>
      </div>

      {!isSuggestion && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
          <div className="text-xs space-y-0.5">
            <p className="font-medium text-foreground">
              {t('chat.tool_request.failed_tool', { tool: request.failedToolName })}
            </p>
            <p className="text-muted-foreground">{request.errorMessage}</p>
          </div>
        </div>
      )}

      <p className="text-sm text-foreground">
        {t(isSuggestion ? 'chat.tool_request.suggest_prompt' : 'chat.tool_request.prompt')}
      </p>

      {request.availableTools.length > 0 ? (
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {Object.entries(byCategory).map(([category, tools]) => (
            <div key={category} className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{category}</p>
              <div className="grid grid-cols-1 gap-1.5">
                {tools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => toggle(tool.id)}
                    className={cn(
                      'rounded-lg px-3 py-2 text-left border transition-all flex items-start gap-2.5',
                      selected.includes(tool.id)
                        ? 'bg-primary/10 border-primary/40 text-primary'
                        : 'bg-background border-border/60 text-foreground hover:border-primary/40 hover:bg-primary/5',
                    )}
                  >
                    <div className={cn(
                      'mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors',
                      selected.includes(tool.id) ? 'border-primary bg-primary' : 'border-border',
                    )} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium leading-snug">{tool.name}</span>
                      {tool.description && (
                        <span className={cn(
                          'text-[10px] leading-snug mt-0.5 line-clamp-2',
                          selected.includes(tool.id) ? 'text-primary/70' : 'text-muted-foreground',
                        )}>
                          {tool.description}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t('chat.tool_request.no_tools')}</p>
      )}

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={autoActivate}
          onChange={(e) => setAutoActivate(e.target.checked)}
          className="h-3.5 w-3.5 rounded accent-primary"
        />
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Zap className="h-3 w-3" />
          {t('chat.tool_request.auto_activate')}
        </span>
      </label>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (autoActivate) setAutoActivateTools(true);
            onAnswer(selected);
          }}
          disabled={selected.length === 0}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
        >
          <Send className="h-3.5 w-3.5" />
          {t('chat.tool_request.confirm', { count: selected.length })}
        </button>
        <button
          onClick={() => onAnswer([])}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {t('chat.tool_request.skip')}
        </button>
      </div>
    </div>
  );
}
