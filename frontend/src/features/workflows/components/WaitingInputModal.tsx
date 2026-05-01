'use client';

import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircleQuestion, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AgentReplyBar, QuestionType } from './AgentReplyBar';
import { StructuredDataViewer } from './StructuredDataViewer';

function isJSON(value: string): boolean {
  const trimmed = value.trim();
  return (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  );
}

function tryParseJSON(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export interface WaitingInputModalProps {
  waitingNodeId: string;
  executionId: string | null;
  waitingPrompt: string | null;
  waitingAgentText: string | null;
  waitingProposals: string[];
  waitingQuestionType: QuestionType;
  onCancel: () => void;
  isCancelling: boolean;
}

export const WaitingInputModal = memo(({
  waitingNodeId,
  executionId,
  waitingPrompt,
  waitingAgentText,
  waitingProposals,
  waitingQuestionType,
  onCancel,
  isCancelling,
}: WaitingInputModalProps) => {
  const { t } = useTranslation();
  const isDanger = waitingQuestionType === 'danger_choice';
  const isOAuth = waitingQuestionType === 'oauth_required';

  return (
    <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/20 backdrop-blur-sm pointer-events-auto transition-opacity animate-in fade-in">
      <Card
        className={cn(
          'w-[560px] shadow-2xl backdrop-blur-xl border-border/50 animate-in zoom-in-95',
          isDanger
            ? 'bg-white/95 dark:bg-black/95 border-red-500/30'
            : isOAuth
              ? 'bg-white/95 dark:bg-black/95 border-amber-500/30'
              : 'bg-white/90 dark:bg-black/90',
        )}
      >
        <CardHeader className="pb-2 border-b border-border/50">
          <div className="flex items-start justify-between gap-2">
            <CardTitle
              className={cn(
                'flex items-center gap-2 text-sm',
                isDanger ? 'text-red-500' : isOAuth ? 'text-amber-500' : 'text-blue-500',
              )}
            >
              <MessageCircleQuestion className="h-4 w-4 shrink-0" />
              {isDanger
                ? t('workflows.waitingInput.dangerTitle', 'Dangerous Action — Confirmation Required')
                : isOAuth
                  ? t('workflows.waitingInput.oauthTitle', 'GitHub Permission Required')
                  : t('workflows.waitingInput.title', 'Agent Needs Your Input')}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={onCancel}
              disabled={isCancelling}
              title={t('workflows.waitingInput.cancelExecution', 'Cancel execution')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {waitingPrompt && (
            <p
              className={cn(
                'text-sm font-semibold mt-1 leading-snug',
                isDanger ? 'text-red-600 dark:text-red-400' : 'text-foreground',
              )}
            >
              {waitingPrompt}
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-4 max-h-[70vh] overflow-y-auto space-y-3">
          {waitingAgentText &&
            waitingAgentText !== waitingPrompt &&
            (isJSON(waitingAgentText) ? (
              <StructuredDataViewer
                data={tryParseJSON(waitingAgentText)}
                className="min-h-[80px]"
              />
            ) : (
              <div className="text-sm leading-relaxed text-foreground/80 prose prose-sm dark:prose-invert max-w-none border-l-2 border-border/60 pl-3">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{waitingAgentText}</ReactMarkdown>
              </div>
            ))}
          <AgentReplyBar
            nodeId={waitingNodeId}
            executionId={executionId}
            agentText={waitingAgentText ?? undefined}
            externalProposals={waitingProposals}
            questionType={waitingQuestionType}
          />
          <div className="pt-1 border-t border-border/30 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-destructive gap-1.5"
              onClick={onCancel}
              disabled={isCancelling}
            >
              <X className="h-3 w-3" />
              {isCancelling
                ? t('workflows.waitingInput.cancelling', 'Cancelling…')
                : t('workflows.waitingInput.cancelExecution', 'Cancel execution')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

WaitingInputModal.displayName = 'WaitingInputModal';
