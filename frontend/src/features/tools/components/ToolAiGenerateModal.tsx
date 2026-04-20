'use client';

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Send, RefreshCw, Sparkles, Wrench, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ModelSelector } from '@/features/workflows/components/ModelSelector';
import { toolsApi, ToolAiResult } from '../api/tools.api';
import { toast } from 'sonner';

interface ToolAiGenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SUGGESTIONS = [
  'A tool that fetches weather data from an API',
  'A tool that reads a PDF and extracts text content',
  'A tool that creates a Trello card from a title and description',
  'A tool that searches the web and returns top 5 results',
];

const CATEGORY_COLORS: Record<string, string> = {
  WEB: 'bg-sky-500/10 text-sky-600',
  API: 'bg-violet-500/10 text-violet-600',
  DATABASE: 'bg-green-500/10 text-green-600',
  FILE: 'bg-orange-500/10 text-orange-600',
  CUSTOM: 'bg-amber-500/10 text-amber-600',
  MCP: 'bg-pink-500/10 text-pink-600',
};

export function ToolAiGenerateModal({ open, onOpenChange }: ToolAiGenerateModalProps) {
  const queryClient = useQueryClient();

  const [modelId, setModelId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [result, setResult] = useState<ToolAiResult | null>(null);
  const [messages, setMessages] = useState<ToolAiResult['history']>([]);

  const handleClose = () => {
    if (isCreating) return; // prevent accidental close during save
    onOpenChange(false);
    setPrompt('');
    setResult(null);
    setMessages([]);
    setSessionId(null);
  };

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || !modelId || isGenerating) return;

    const userPrompt = prompt.trim();
    setPrompt('');
    setIsGenerating(true);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userPrompt, timestamp: new Date().toISOString() },
    ]);

    try {
      const res = await toolsApi.generateWithAi({
        prompt: userPrompt,
        modelId,
        sessionId: sessionId ?? undefined,
      });
      setSessionId(res.sessionId);
      setResult(res);
      setMessages(res.history);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, modelId, sessionId, isGenerating]);

  const handleCreate = async () => {
    if (!result?.config || isCreating) return;

    setIsCreating(true);
    try {
      await toolsApi.create({
        name: result.config.name,
        description: result.config.description,
        category: result.config.category,
        parameters: result.config.parameters,
        code: result.config.code,
        icon: result.config.icon,
        isBuiltIn: true,
      });

      await queryClient.invalidateQueries({ queryKey: ['tools'] });
      toast.success(`Tool "${result.config.name}" created successfully`);
      onOpenChange(false);
      // Reset after close
      setPrompt('');
      setResult(null);
      setMessages([]);
      setSessionId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create tool');
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const categoryColor = result?.config
    ? (CATEGORY_COLORS[result.config.category] ?? CATEGORY_COLORS.CUSTOM)
    : '';

  const isBusy = isGenerating || isCreating;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Generate Tool with AI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Model selector */}
          <div className="space-y-1.5">
            <Label>AI Model</Label>
            <ModelSelector value={modelId} onChange={setModelId} disabled={isBusy} />
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
              {isGenerating && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span className="text-xs">Designing tool…</span>
                </div>
              )}
            </div>
          )}

          {/* Generated preview */}
          {result?.config && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-amber-500" />
                  <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                    {result.config.name}
                  </p>
                </div>
                <Badge variant="secondary" className={`text-xs border-none ${categoryColor}`}>
                  {result.config.category}
                </Badge>
              </div>
              {result.config.description && (
                <p className="text-xs text-muted-foreground">{result.config.description}</p>
              )}

              {/* Parameters */}
              {result.config.parameters.length > 0 && (
                <div className="pt-1 border-t border-amber-500/20 space-y-1">
                  <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-wide">
                    Parameters ({result.config.parameters.length})
                  </p>
                  <div className="space-y-0.5">
                    {result.config.parameters.map((p) => (
                      <div key={p.name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="font-mono text-foreground/70">{p.name}</span>
                        <span className="text-muted-foreground/50">·</span>
                        <span>{p.type}</span>
                        {p.required && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-amber-500/30 text-amber-600">
                            required
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Code preview */}
              {result.config.code && (
                <div className="pt-1 border-t border-amber-500/20">
                  <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-wide mb-1">
                    Code Preview
                  </p>
                  <pre className="text-[10px] text-muted-foreground bg-muted/30 rounded p-1.5 overflow-x-auto max-h-20 font-mono">
                    {result.config.code.slice(0, 300)}{result.config.code.length > 300 ? '…' : ''}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Suggestions */}
          {messages.length === 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Try one of these:</p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
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
                  ? 'Select a model above first…'
                  : messages.length > 0
                  ? 'Refine or ask for changes…'
                  : 'Describe the tool you want to create…'
              }
              disabled={!modelId || isBusy}
              rows={3}
              className="resize-none pr-10 text-sm"
            />
            <Button
              size="icon"
              variant="ghost"
              className="absolute bottom-2 right-2 h-7 w-7 disabled:opacity-30"
              onClick={handleGenerate}
              disabled={!prompt.trim() || !modelId || isBusy}
            >
              {isGenerating ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isCreating}>
              Cancel
            </Button>
            {result?.config ? (
              <Button
                className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                onClick={handleCreate}
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create Tool
                  </>
                )}
              </Button>
            ) : (
              <Button
                className="gap-2"
                onClick={handleGenerate}
                disabled={!prompt.trim() || !modelId || isBusy}
              >
                <Sparkles className="h-4 w-4" />
                {isGenerating ? 'Generating…' : 'Generate'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
