'use client';

import { useState, useCallback } from 'react';
import { Send, RefreshCw, Sparkles, CheckCheck, Bot, Wrench } from 'lucide-react';
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
import { agentsApi, AgentAiResult, GeneratedAgentConfig, ProvisionedTool } from '../api/agents.api';
import { toast } from 'sonner';

interface AgentAiGenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (config: GeneratedAgentConfig, modelId: string, provisionedTools?: ProvisionedTool[]) => void;
}

const SUGGESTIONS = [
  'An agent that reads PDF files and extracts action items',
  'A code review agent that checks TypeScript for bugs and style issues',
  'A customer support agent that triages and categorizes support tickets',
  'A research agent that summarizes web articles into bullet points',
];

export function AgentAiGenerateModal({ open, onOpenChange, onApply }: AgentAiGenerateModalProps) {
  const [modelId, setModelId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AgentAiResult | null>(null);
  const [messages, setMessages] = useState<AgentAiResult['history']>([]);

  const handleClose = () => {
    onOpenChange(false);
    // Reset state when closing
    setPrompt('');
    setResult(null);
    setMessages([]);
    setSessionId(null);
  };

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
      const res = await agentsApi.generateWithAi({
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
      setIsLoading(false);
    }
  }, [prompt, modelId, sessionId, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleApply = () => {
    if (!result?.config) return;
    onApply(result.config, modelId, result.provisionedTools);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-500" />
            Generate Agent with AI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Model selector */}
          <div className="space-y-1.5">
            <Label>AI Model</Label>
            <ModelSelector value={modelId} onChange={setModelId} disabled={isLoading} />
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
                  <span className="text-xs">Designing agent…</span>
                </div>
              )}
            </div>
          )}

          {/* Generated preview */}
          {result?.config && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-blue-500" />
                  <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {result.config.name}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-600 border-none">
                  temp {result.config.temperature}
                </Badge>
              </div>
              {result.config.description && (
                <p className="text-xs text-muted-foreground">{result.config.description}</p>
              )}
              <div className="pt-1 border-t border-blue-500/20 space-y-1">
                <p className="text-[11px] font-semibold text-blue-500 uppercase tracking-wide">
                  System Prompt Preview
                </p>
                <p className="text-[11px] text-muted-foreground line-clamp-3 font-mono bg-muted/30 rounded p-1.5">
                  {result.config.systemPrompt}
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>Max tokens: <strong>{result.config.maxTokens}</strong></span>
                {result.config.tools.length > 0 && (
                  <span>Tools: <strong>{result.config.tools.length}</strong></span>
                )}
              </div>
              {result.provisionedTools && result.provisionedTools.length > 0 && (
                <div className="pt-1 border-t border-blue-500/20 space-y-1">
                  <p className="text-[11px] font-semibold text-blue-500 uppercase tracking-wide flex items-center gap-1">
                    <Wrench className="h-3 w-3" />
                    Tools resolved
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {result.provisionedTools.map((t) => (
                      <span
                        key={t.id}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          t.created
                            ? 'bg-green-500/10 text-green-600 ring-1 ring-green-500/30'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {t.created ? '+ ' : ''}{t.name}
                      </span>
                    ))}
                  </div>
                  {result.provisionedTools.some((t) => t.created) && (
                    <p className="text-[10px] text-green-600">
                      Green = auto-created · Grey = matched existing
                    </p>
                  )}
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
                  : 'Describe the agent you want to create…'
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
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            {result?.config ? (
              <Button
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleApply}
              >
                <CheckCheck className="h-4 w-4" />
                Use this configuration
              </Button>
            ) : (
              <Button
                className="gap-2"
                onClick={handleGenerate}
                disabled={!prompt.trim() || !modelId || isLoading}
              >
                <Sparkles className="h-4 w-4" />
                {isLoading ? 'Generating…' : 'Generate'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
