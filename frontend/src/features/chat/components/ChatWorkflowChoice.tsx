'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GitBranch, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkflowChoice } from '../store/chat.store';

interface Props {
  choice: WorkflowChoice;
  onAnswer: (answer: string) => void;
}

export function ChatWorkflowChoice({ choice, onAnswer }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>([]);
  const [freeText, setFreeText] = useState('');

  const hasChoices = choice.choices.length > 0;

  const toggle = (c: string) => {
    if (choice.multiSelect) {
      setSelected((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
    } else {
      onAnswer(c);
    }
  };

  const submit = () => {
    if (selected.length > 0) {
      onAnswer(selected.join(', '));
    } else if (freeText.trim()) {
      onAnswer(freeText.trim());
    }
  };

  return (
    <div className="mx-4 mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-primary">
        <GitBranch className="h-3.5 w-3.5" />
        <span>{t('chat.workflow.waiting_input')}</span>
      </div>

      {choice.agentMessage && (
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{choice.agentMessage}</p>
      )}

      <p className="text-sm font-medium text-foreground">{choice.prompt}</p>

      {hasChoices ? (
        <div className="flex flex-wrap gap-2">
          {choice.choices.map((c) => (
            <button
              key={c}
              onClick={() => toggle(c)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium border transition-all',
                selected.includes(c)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border/60 text-foreground hover:border-primary/50 hover:bg-primary/5',
              )}
            >
              {c}
            </button>
          ))}
          {choice.multiSelect && selected.length > 0 && (
            <button
              onClick={submit}
              className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
              {t('chat.workflow.confirm')}
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            autoFocus
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={t('chat.workflow.type_answer')}
            className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-sm outline-none focus:border-primary/40"
          />
          <button
            onClick={submit}
            disabled={!freeText.trim()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
