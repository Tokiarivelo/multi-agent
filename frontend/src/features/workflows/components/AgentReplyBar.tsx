'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { workflowsApi } from '../api/workflows.api';
import { githubApi } from '@/features/github/api/github.api';
import { toast } from 'sonner';
import {
  MessageCircleQuestion,
  Check,
  Plus,
  Loader2,
  SendHorizontal,
  AlertTriangle,
  ToggleLeft,
  ListChecks,
  Pencil,
  Github,
  CheckCircle2,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type QuestionType = 'single_choice' | 'multiple_choice' | 'danger_choice' | 'custom' | 'oauth_required';

export interface AgentReplyBarProps {
  nodeId: string;
  executionId: string | null;
  agentText?: string;
  externalProposals?: string[];
  /** @deprecated use questionType instead */
  multiSelect?: boolean;
  questionType?: QuestionType;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function parseProposals(text: string): string[] {
  const lines = text.split('\n');
  const proposals: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*(?:\d+[.):]|[-•*])\s+(.+)/);
    if (m && m[1].trim().length > 0) {
      proposals.push(m[1].trim());
    }
  }
  return proposals;
}

/** Resolve the effective QuestionType from props */
function resolveQuestionType(
  questionType: QuestionType | undefined,
  multiSelect: boolean | undefined,
  proposals: string[],
): QuestionType {
  if (questionType) return questionType;
  if (proposals.length === 0) return 'custom';
  return multiSelect ? 'multiple_choice' : 'single_choice';
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface ChoiceChipsProps {
  proposals: string[];
  selected: string[];
  multi: boolean;
  danger?: boolean;
  onToggle: (value: string) => void;
}

function ChoiceChips({ proposals, selected, multi, danger = false, onToggle }: ChoiceChipsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {proposals.map((p, i) => {
        const isSelected = selected.includes(p);
        return (
          <button
            key={i}
            type="button"
            onClick={() => onToggle(p)}
            className={cn(
              'group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-150 text-left',
              danger
                ? isSelected
                  ? 'border-red-500/60 bg-red-500/15 text-red-600 dark:text-red-400 shadow-sm'
                  : 'border-border/60 bg-background/60 text-muted-foreground hover:border-red-500/40 hover:bg-red-500/8 hover:text-red-500'
                : isSelected
                  ? 'border-blue-500/60 bg-blue-500/15 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'border-border/60 bg-background/60 text-muted-foreground hover:border-blue-500/40 hover:bg-blue-500/8 hover:text-foreground',
            )}
          >
            {isSelected && <Check className="h-3 w-3 shrink-0" />}
            {multi && !isSelected && (
              <span className="h-3 w-3 shrink-0 rounded-sm border border-current opacity-40" />
            )}
            <span className="max-w-[220px] truncate" title={p}>
              {i + 1}. {p}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Danger Confirmation Bar ───────────────────────────────────────────────────

interface DangerBarProps {
  question: string;
  proposals: string[];
  executionId: string | null;
  nodeId: string;
  onDone: () => void;
}

function DangerBar({ question, proposals, executionId, nodeId, onDone }: DangerBarProps) {
  const { t } = useTranslation();
  const [confirmed, setConfirmed] = useState(false);
  const [selected, setSelected] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const choices = proposals.length > 0 ? proposals : ['Confirm', 'Cancel'];

  const handleSend = async () => {
    if (!executionId || !selected) return;
    setIsSubmitting(true);
    try {
      await workflowsApi.resumeNode(executionId, nodeId, selected);
      onDone();
      toast.success(t('workflows.agentReply.sent', 'Response sent — workflow resuming…'));
    } catch (err) {
      toast.error(`Failed to send: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!confirmed) {
    return (
      <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/5 p-3 space-y-3 animate-in fade-in slide-in-from-bottom-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-xs font-semibold text-red-500">
            {t('workflows.agentReply.dangerTitle', 'Dangerous action — confirmation required')}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{question}</p>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="destructive"
            className="h-8 gap-2 text-xs"
            onClick={() => setConfirmed(true)}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {t('workflows.agentReply.proceed', 'I understand — proceed')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/5 p-3 space-y-3 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
        <p className="text-xs font-semibold text-red-500">
          {t('workflows.agentReply.chooseAction', 'Choose action')}
        </p>
      </div>
      <ChoiceChips
        proposals={choices}
        selected={selected ? [selected] : []}
        multi={false}
        danger
        onToggle={(v) => setSelected((prev) => (prev === v ? '' : v))}
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="destructive"
          className="h-8 gap-2 text-xs"
          onClick={handleSend}
          disabled={isSubmitting || !selected || !executionId}
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <SendHorizontal className="h-3.5 w-3.5" />
          )}
          {isSubmitting
            ? t('workflows.agentReply.sending', 'Sending…')
            : t('workflows.agentReply.confirm', 'Confirm')}
        </Button>
      </div>
    </div>
  );
}

// ─── GitHub OAuth Bar ──────────────────────────────────────────────────────────

interface OAuthBarProps {
  executionId: string | null;
  nodeId: string;
  onDone: () => void;
}

function OAuthBar({ executionId, nodeId, onDone }: OAuthBarProps) {
  const { t } = useTranslation();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const popupRef = useRef<Window | null>(null);

  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      if (event.data?.type !== 'github_oauth_success') return;
      const payload = event.data as { type: string; accessToken: string; login: string; avatarUrl: string };
      setConnected(true);
      setIsConnecting(false);
      popupRef.current?.close();

      try {
        await githubApi.saveTokenToProfile(payload.accessToken);
      } catch {
        // non-fatal
      }

      if (!executionId) return;
      try {
        await workflowsApi.resumeNode(executionId, nodeId, 'github_connected');
        onDone();
        toast.success(t('workflows.agentReply.githubConnected', 'GitHub connected — workflow resuming…'));
      } catch (err) {
        toast.error(`Failed to resume: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [executionId, nodeId, onDone, t]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const { url } = await githubApi.getAuthorizationUrl();
      const popup = window.open(url, 'github_oauth', 'width=600,height=700,scrollbars=yes');
      popupRef.current = popup;
      if (!popup) {
        toast.error(t('workflows.agentReply.githubPopupBlocked', 'Pop-up blocked — allow pop-ups and try again.'));
        setIsConnecting(false);
      }
    } catch (err) {
      toast.error(`Failed to start OAuth: ${err instanceof Error ? err.message : String(err)}`);
      setIsConnecting(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 space-y-3 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2">
        <Github className="h-4 w-4 text-amber-500 shrink-0" />
        <p className="text-xs font-semibold text-amber-500">
          {t('workflows.agentReply.githubAuthTitle', 'GitHub access required')}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          'workflows.agentReply.githubAuthDesc',
          'This action requires access to your GitHub account. Connect once and the workflow will continue automatically.',
        )}
      </p>
      <div className="flex justify-end">
        {connected ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t('workflows.agentReply.githubAuthDone', 'Connected — resuming…')}
          </div>
        ) : (
          <Button
            size="sm"
            className="h-8 gap-2 bg-[#24292e] hover:bg-[#1b1f23] text-white text-xs"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Github className="h-3.5 w-3.5" />
            )}
            {isConnecting
              ? t('workflows.agentReply.githubConnecting', 'Connecting…')
              : t('workflows.agentReply.githubConnectButton', 'Connect GitHub')}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function AgentReplyBar({
  nodeId,
  executionId,
  agentText,
  externalProposals,
  multiSelect: multiSelectProp,
  questionType: questionTypeProp,
}: AgentReplyBarProps) {
  const { t } = useTranslation();

  const parsedFromText = agentText ? parseProposals(agentText) : [];
  const proposals =
    externalProposals && externalProposals.length > 0 ? externalProposals : parsedFromText;

  const questionType = resolveQuestionType(questionTypeProp, multiSelectProp, proposals);
  const isMulti = questionType === 'multiple_choice';
  const isDanger = questionType === 'danger_choice';
  const isCustomOnly = questionType === 'custom';

  const [selected, setSelected] = useState<string[]>([]);
  const [customText, setCustomText] = useState('');
  const [showCustom, setShowCustom] = useState(isCustomOnly || proposals.length === 0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleProposal = (value: string) => {
    if (isMulti) {
      setSelected((prev) =>
        prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value],
      );
    } else {
      setSelected((prev) => (prev[0] === value ? [] : [value]));
    }
  };

  const canSend = selected.length > 0 || customText.trim().length > 0;

  const handleSend = async () => {
    if (!executionId || !canSend) return;
    let finalInput: string;
    if (customText.trim()) {
      finalInput = customText.trim();
    } else if (isMulti) {
      finalInput = JSON.stringify(selected);
    } else {
      finalInput = selected[0] ?? '';
    }
    setIsSubmitting(true);
    try {
      await workflowsApi.resumeNode(executionId, nodeId, finalInput);
      setSelected([]);
      setCustomText('');
      setShowCustom(isCustomOnly || proposals.length === 0);
      toast.success(t('workflows.agentReply.sent', 'Response sent — workflow resuming…'));
    } catch (err) {
      toast.error(`Failed to send response: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // OAuth required: special handler
  if (questionType === 'oauth_required') {
    return (
      <OAuthBar
        executionId={executionId}
        nodeId={nodeId}
        onDone={() => {
          setSelected([]);
          setCustomText('');
        }}
      />
    );
  }

  // Danger type: special handler
  if (isDanger) {
    return (
      <DangerBar
        question={agentText ?? ''}
        proposals={proposals}
        executionId={executionId}
        nodeId={nodeId}
        onDone={() => {
          setSelected([]);
          setCustomText('');
        }}
      />
    );
  }

  // ── Header label per type ─────────────────────────────────────────────
  const typeLabel = isCustomOnly
    ? t('workflows.agentReply.typeCustom', 'Type your response')
    : isMulti
      ? t('workflows.agentReply.typeMulti', 'Select all that apply')
      : t('workflows.agentReply.typeSingle', 'Choose one');

  const TypeIcon = isCustomOnly
    ? Pencil
    : isMulti
      ? ListChecks
      : ToggleLeft;

  return (
    <div className="mt-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 space-y-3 animate-in fade-in slide-in-from-bottom-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageCircleQuestion className="h-4 w-4 text-blue-500 shrink-0" />
        <p className="text-xs font-semibold text-blue-500 flex items-center gap-1.5">
          <TypeIcon className="h-3 w-3" />
          {typeLabel}
        </p>
      </div>

      {/* Proposal chips */}
      {!isCustomOnly && proposals.length > 0 && (
        <ChoiceChips
          proposals={proposals}
          selected={selected}
          multi={isMulti}
          onToggle={toggleProposal}
        />
      )}

      {/* Toggle custom input (only shown when there are choices) */}
      {!isCustomOnly && proposals.length > 0 && (
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" />
          {showCustom
            ? t('workflows.agentReply.hideCustom', 'Hide custom response')
            : t('workflows.agentReply.addCustom', 'Add custom response')}
        </button>
      )}

      {/* Custom text input */}
      {(showCustom || isCustomOnly) && (
        <div className="flex items-center gap-2">
          <Input
            autoFocus={isCustomOnly || proposals.length === 0}
            placeholder={
              selected.length > 0
                ? t('workflows.agentReply.overridePlaceholder', 'Override with custom text (optional)…')
                : t('workflows.agentReply.typePlaceholder', 'Type your response…')
            }
            className="h-8 text-xs bg-background/60"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) handleSend();
            }}
            disabled={isSubmitting}
          />
        </div>
      )}

      {/* Send */}
      <div className="flex justify-end">
        <Button
          size="sm"
          className="h-8 gap-2 bg-blue-500 hover:bg-blue-600 text-white text-xs"
          onClick={handleSend}
          disabled={isSubmitting || !canSend || !executionId}
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <SendHorizontal className="h-3.5 w-3.5" />
          )}
          {isSubmitting
            ? t('workflows.agentReply.sending', 'Sending…')
            : t('workflows.agentReply.send', 'Send Response')}
        </Button>
      </div>
    </div>
  );
}
