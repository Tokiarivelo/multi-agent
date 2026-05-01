'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Brain, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { ChatThinkingStep } from '../api/chat.api';

interface Props {
  steps: ChatThinkingStep[];
}

export function ChatThinkingPanel({ steps }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (steps.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 text-sm mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Brain className="h-4 w-4 shrink-0 text-primary" />
        <span className="font-medium">{t('chat.thinking.title')}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {steps.length} {steps.length === 1 ? 'step' : 'steps'}
        </span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border/40 px-3 py-2 space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-2">
              {step.toolName ? (
                <Wrench className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
              ) : (
                <Brain className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/60" />
              )}
              <div className="min-w-0">
                <div className={cn('text-xs font-medium', step.toolName ? 'text-amber-600 dark:text-amber-400' : 'text-primary/80')}>
                  {step.toolName ? `${t('chat.thinking.tool_call')}: ${step.toolName}` : t(`chat.thinking.${step.step}`) || step.step}
                </div>
                {step.thought && (
                  <p className="text-xs text-muted-foreground mt-0.5 break-words">{step.thought}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
