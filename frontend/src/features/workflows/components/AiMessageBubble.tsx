'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AiMessage } from '../api/workflows.api';
import { NodePreviewStrip } from './NodePreviewStrip';
import { WorkflowNode } from '@/types';

interface ParsedAiResponse {
  name?: string;
  description?: string;
  message?: string;
  definition?: { nodes?: WorkflowNode[]; edges?: unknown[] };
}

export function AiMessageBubble({ msg }: { msg: AiMessage }) {
  const { t } = useTranslation();
  const isUser = msg.role === 'user';
  const [defOpen, setDefOpen] = useState(false);

  let parsed: ParsedAiResponse | null = null;
  if (!isUser) {
    try {
      const cleaned = msg.content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();
      parsed = JSON.parse(cleaned) as ParsedAiResponse;
    } catch {
      /* not JSON */
    }
  }

  const hasDefinition = parsed !== null && 'definition' in (parsed ?? {});
  const displayText =
    parsed?.message ?? (hasDefinition ? t('workflows.ai.generatedWorkflow') : msg.content);
  const nodes = (parsed?.definition?.nodes ?? []) as WorkflowNode[];

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted text-foreground rounded-tl-sm',
        )}
      >
        {!isUser && hasDefinition ? (
          <div className="space-y-2">
            <p className="text-sm">{displayText}</p>
            {nodes.length > 0 && <NodePreviewStrip nodes={nodes} maxVisible={6} className="mt-1" />}
            {parsed?.name && (
              <Badge variant="outline" className="text-[10px]">
                {parsed.name}
              </Badge>
            )}
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setDefOpen((v) => !v)}
            >
              {defOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {defOpen ? t('workflows.ai.hideJson') : t('workflows.ai.showJson')}
            </button>
            {defOpen && (
              <pre className="text-[10px] font-mono bg-black/10 dark:bg-white/5 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                {JSON.stringify(parsed?.definition, null, 2)}
              </pre>
            )}
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">
            {msg.content}
          </p>
        )}
        <p className="text-[10px] opacity-50 mt-1 text-right">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
