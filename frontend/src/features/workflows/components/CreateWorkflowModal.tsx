'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Send, RefreshCw, Sparkles, CheckCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useCreateWorkflow } from '../hooks/useWorkflows';
import { workflowsApi, AiWorkflowResult } from '../api/workflows.api';
import { ModelSelector } from './ModelSelector';

interface CreateWorkflowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Manual tab ───────────────────────────────────────────────────────────────

function ManualTab({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const createWorkflow = useCreateWorkflow();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError(t('workflows.create.nameRequired'));
      return;
    }
    setNameError('');
    createWorkflow.mutate(
      { name: name.trim(), description: description.trim() || undefined },
      { onSuccess: onCreated },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label htmlFor="wf-name-manual">{t('workflows.editor.nameLabel')}</Label>
        <Input
          id="wf-name-manual"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError('');
          }}
          placeholder={t('workflows.editor.namePlaceholder')}
          autoFocus
        />
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wf-desc-manual">{t('workflows.editor.descLabel')}</Label>
        <Textarea
          id="wf-desc-manual"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('workflows.editor.descPlaceholder')}
          rows={3}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={createWorkflow.isPending}
        >
          {t('workflows.editor.cancel')}
        </Button>
        <Button type="submit" disabled={createWorkflow.isPending}>
          {createWorkflow.isPending
            ? t('workflows.create.creating')
            : t('workflows.create.submit')}
        </Button>
      </div>
    </form>
  );
}

// ─── AI generation tab ────────────────────────────────────────────────────────

function AiTab({
  onApply,
  onCancel,
}: {
  onApply: (result: AiWorkflowResult) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [modelId, setModelId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AiWorkflowResult | null>(null);
  const [messages, setMessages] = useState<Array<{ role: string; content: string; timestamp: string }>>([]);

  const suggestions = [
    'Automated code review and testing pipeline',
    'Daily report generation and email delivery',
    'Customer support ticket triage and routing',
    'Data transformation and validation workflow',
  ];

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || !modelId || isLoading) return;

    const userPrompt = prompt.trim();
    setPrompt('');
    setIsLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userPrompt, timestamp: new Date().toISOString() },
    ]);

    try {
      const res = await workflowsApi.generateWithAi({
        prompt: userPrompt,
        modelId,
        sessionId: sessionId ?? undefined,
      });
      setSessionId(res.sessionId);
      setResult(res);
      setMessages(res.history);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('workflows.ai.error', 'Generation failed'));
      setMessages((prev) => prev.slice(0, -1)); // remove optimistic user message
    } finally {
      setIsLoading(false);
    }
  }, [prompt, modelId, sessionId, isLoading, t]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const nodeCount = result?.definition?.nodes?.length ?? 0;

  return (
    <div className="space-y-4 pt-2">
      {/* Model selector */}
      <div className="space-y-1.5">
        <Label>{t('workflows.ai.model', 'AI Model')}</Label>
        <ModelSelector
          value={modelId}
          onChange={setModelId}
          disabled={isLoading}
        />
      </div>

      {/* Message history */}
      {messages.length > 0 && (
        <div className="max-h-40 overflow-y-auto space-y-2 rounded-lg border border-border/50 p-3 bg-muted/20 text-sm">
          {messages.map((msg, i) => (
            <div key={i} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
              <span
                className={`inline-block px-2.5 py-1.5 rounded-xl text-xs max-w-[85%] ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {msg.role === 'user'
                  ? msg.content
                  : (() => {
                      try {
                        const p = JSON.parse(msg.content);
                        return p.message ?? msg.content;
                      } catch {
                        return msg.content;
                      }
                    })()}
              </span>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span className="text-xs">{t('workflows.ai.thinking', 'Thinking…')}</span>
            </div>
          )}
        </div>
      )}

      {/* Generated preview */}
      {result?.definition && (
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-violet-600 dark:text-violet-400">
              {result.name ?? t('workflows.ai.generatedWorkflow', 'Generated Workflow')}
            </p>
            <Badge variant="secondary" className="text-xs">
              {nodeCount} {t('workflows.canvas.nodes')}
            </Badge>
          </div>
          {result.description && (
            <p className="text-xs text-muted-foreground">{result.description}</p>
          )}
        </div>
      )}

      {/* Suggestions */}
      {messages.length === 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            {t('workflows.ai.suggestions', 'Try one of these:')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                className="text-[11px] px-2 py-1 rounded-full border border-border/60 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                onClick={() => setPrompt(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prompt input */}
      <div className="relative">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            !modelId
              ? t('workflows.ai.selectModelFirst', 'Select a model above first…')
              : messages.length > 0
              ? t('workflows.ai.refinePrompt', 'Refine or ask for changes…')
              : t('workflows.ai.generatePlaceholder', 'Describe the workflow you want to create…')
          }
          disabled={!modelId || isLoading}
          rows={3}
          className="resize-none pr-10 text-sm"
        />
        <Button
          size="icon"
          variant="ghost"
          className="absolute bottom-2 right-2 h-7 w-7 disabled:opacity-30"
          onClick={handleGenerate}
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
        {result?.definition ? (
          <Button
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
            onClick={() => onApply(result)}
          >
            <CheckCheck className="h-4 w-4" />
            {t('workflows.ai.createFromThis', 'Create from this')}
          </Button>
        ) : (
          <Button
            className="gap-2"
            onClick={handleGenerate}
            disabled={!prompt.trim() || !modelId || isLoading}
          >
            <Sparkles className="h-4 w-4" />
            {isLoading
              ? t('workflows.ai.generating', 'Generating…')
              : t('workflows.ai.generate', 'Generate')}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function CreateWorkflowModal({ open, onOpenChange }: CreateWorkflowModalProps) {
  const { t } = useTranslation();
  const createWorkflow = useCreateWorkflow();
  const [tab, setTab] = useState<'manual' | 'ai'>('manual');

  const handleClose = () => onOpenChange(false);

  const handleAiApply = (result: AiWorkflowResult) => {
    if (!result.definition) return;
    createWorkflow.mutate(
      {
        name: result.name ?? 'AI Generated Workflow',
        description: result.description,
        definition: result.definition,
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to create workflow');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !createWorkflow.isPending && onOpenChange(isOpen)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('workflows.create.title')}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'manual' | 'ai')}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="manual" className="gap-2">
              <Pencil className="h-3.5 w-3.5" />
              {t('workflows.create.tabManual', 'Manual')}
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              {t('workflows.create.tabAi', 'Generate with AI')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
            <ManualTab onCreated={handleClose} onCancel={handleClose} />
          </TabsContent>

          <TabsContent value="ai">
            <AiTab onApply={handleAiApply} onCancel={handleClose} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
