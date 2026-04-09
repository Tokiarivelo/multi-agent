import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { workflowsApi } from '../api/workflows.api';
import { toast } from 'sonner';
import { MessageCircleQuestion, Check, Plus, Loader2, SendHorizontal } from 'lucide-react';

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

interface AgentReplyBarProps {
  nodeId: string;
  executionId: string | null;
  agentText: string | undefined;
  externalProposals?: string[];
  multiSelect?: boolean;
}

export function AgentReplyBar({
  nodeId,
  executionId,
  agentText,
  externalProposals,
  multiSelect: multiSelectProp,
}: AgentReplyBarProps) {
  const parsedFromText = agentText ? parseProposals(agentText) : [];
  const proposals =
    externalProposals && externalProposals.length > 0 ? externalProposals : parsedFromText;
  const multiSelect = multiSelectProp ?? true;

  const [selected, setSelected] = useState<string[]>([]);
  const [customText, setCustomText] = useState('');
  const [showCustom, setShowCustom] = useState(proposals.length === 0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleProposal = (value: string) => {
    if (multiSelect) {
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
    } else if (multiSelect) {
      finalInput = JSON.stringify(selected);
    } else {
      finalInput = selected[0] ?? '';
    }
    setIsSubmitting(true);
    try {
      await workflowsApi.resumeNode(executionId, nodeId, finalInput);
      setSelected([]);
      setCustomText('');
      setShowCustom(proposals.length === 0);
      toast.success('Response sent — workflow resuming…');
    } catch (err) {
      toast.error(`Failed to send response: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 space-y-3 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2">
        <MessageCircleQuestion className="h-4 w-4 text-blue-500 shrink-0" />
        <p className="text-xs font-semibold text-blue-500">
          Choose a response{multiSelect && proposals.length > 1 ? ' (multi-select)' : ''}
        </p>
      </div>

      {proposals.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {proposals.map((p, i) => {
            const isSelected = selected.includes(p);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleProposal(p)}
                className={cn(
                  'group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-150 text-left',
                  isSelected
                    ? 'border-blue-500/60 bg-blue-500/15 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'border-border/60 bg-background/60 text-muted-foreground hover:border-blue-500/40 hover:bg-blue-500/8 hover:text-foreground',
                )}
              >
                {isSelected && <Check className="h-3 w-3 shrink-0" />}
                <span className="max-w-[220px] truncate" title={p}>
                  {i + 1}. {p}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {proposals.length > 0 && (
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" />
          {showCustom ? 'Hide custom response' : 'Add custom response'}
        </button>
      )}

      {showCustom && (
        <div className="flex items-center gap-2">
          <Input
            autoFocus={proposals.length === 0}
            placeholder={
              selected.length > 0
                ? 'Override with custom text (optional)…'
                : 'Type your response…'
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
          {isSubmitting ? 'Sending…' : 'Send Response'}
        </Button>
      </div>
    </div>
  );
}
