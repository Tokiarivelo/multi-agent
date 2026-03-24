'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, CheckCircle2, XCircle, Clock, Loader2, Terminal } from 'lucide-react';
import { Tool, ToolParameter, ToolExecutionResult } from '@/types';
import { useExecuteTool } from '../hooks/useTools';
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore';

interface ExecuteToolModalProps {
  tool: Tool | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildInitialValues(parameters: ToolParameter[]): Record<string, string> {
  return Object.fromEntries(
    parameters.map((p) => [p.name, p.default !== undefined ? String(p.default) : '']),
  );
}

function parseValue(raw: string, type: string): unknown {
  if (type === 'number') return raw === '' ? undefined : Number(raw);
  if (type === 'boolean') return raw === 'true';
  if (type === 'object' || type === 'array') {
    try {
      return raw === '' ? undefined : JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

// ─── Shell command input ───────────────────────────────────────────────────────

function ShellCommandInput({
  value,
  cwd,
  disabled,
  onChange,
  onRun,
}: {
  value: string;
  cwd?: string;
  disabled: boolean;
  onChange: (v: string) => void;
  onRun: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const promptLabel = cwd ? cwd.split('/').pop() || cwd : '~';

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 38)}px`;
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Shift+Enter → run
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onRun();
    }
    // Plain Enter without shift = newline is allowed (multi-line commands)
  };

  return (
    <div
      className="rounded-md overflow-hidden border border-zinc-700 bg-zinc-950 cursor-text"
      onClick={() => textareaRef.current?.focus()}
    >
      {/* Terminal title bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <Terminal className="h-3 w-3 text-zinc-500" />
        <span className="text-xs font-mono text-zinc-400 truncate" title={cwd}>
          {cwd ?? 'shell'}
        </span>
      </div>

      {/* Input row */}
      <div className="flex items-start gap-2 px-3 py-2">
        <span className="text-emerald-500 font-mono text-xs whitespace-nowrap pt-[3px] select-none">
          {promptLabel} $
        </span>
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter shell command… (Ctrl+Enter to run)"
          className="flex-1 bg-transparent text-xs font-mono text-zinc-100 outline-none resize-none caret-emerald-400 placeholder-zinc-600 leading-relaxed"
          spellCheck={false}
          autoFocus
        />
      </div>

      <p className="px-3 pb-1.5 text-[10px] text-zinc-600 font-mono select-none">
        Ctrl+Enter to run · multi-line supported
      </p>
    </div>
  );
}

// ─── Generic parameter field ───────────────────────────────────────────────────

function ParameterField({
  param,
  value,
  onChange,
}: {
  param: ToolParameter;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `param-${param.name}`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {param.name}
        </Label>
        {param.required ? (
          <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">required</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">optional</Badge>
        )}
        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">{param.type}</Badge>
      </div>
      {param.description && (
        <p className="text-xs text-muted-foreground">{param.description}</p>
      )}
      {param.type === 'boolean' ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">— select —</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : param.type === 'object' || param.type === 'array' ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`JSON ${param.type}`}
          rows={3}
          className="font-mono text-xs"
        />
      ) : (
        <Input
          id={id}
          type={param.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.default !== undefined ? `default: ${param.default}` : ''}
        />
      )}
    </div>
  );
}

// ─── Execution result ──────────────────────────────────────────────────────────

function ShellResult({ data, error }: { data?: unknown; error?: string }) {
  const shell = data as { stdout?: string; stderr?: string; code?: number; error?: string } | undefined;
  const stdout = shell?.stdout?.trim();
  const stderr = (shell?.stderr?.trim()) || error || shell?.error;
  const code = shell?.code ?? (error ? 1 : 0);

  return (
    <div className="rounded-md overflow-hidden border border-zinc-700 bg-zinc-950 font-mono text-xs">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
        <Terminal className="h-3 w-3 text-zinc-500" />
        <span className="text-zinc-400">output</span>
        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${code === 0 ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
          exit {code}
        </span>
      </div>
      <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
        {stdout ? (
          <pre className="text-zinc-200 whitespace-pre-wrap leading-relaxed">{stdout}</pre>
        ) : !stderr ? (
          <span className="text-zinc-600 italic">(no output)</span>
        ) : null}
        {stderr && (
          <pre className="text-red-400 whitespace-pre-wrap leading-relaxed">{stderr}</pre>
        )}
      </div>
    </div>
  );
}

function ExecutionResult({ result, isShell }: { result: ToolExecutionResult; isShell: boolean }) {
  return (
    <div className="space-y-3 pt-4 border-t">
      <div className="flex items-center gap-3">
        {result.success ? (
          <div className="flex items-center gap-1.5 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Success</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-destructive">
            <XCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Failed</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <Clock className="h-3 w-3" />
          {result.executionTime}ms
        </div>
      </div>

      {isShell ? (
        <ShellResult data={result.data} error={result.error} />
      ) : (
        <>
          {result.error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive font-mono">
              {result.error}
            </div>
          )}
          {result.data !== undefined && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Output</p>
              <pre className="rounded-md bg-muted/50 p-3 text-xs font-mono overflow-auto max-h-60 text-foreground">
                {typeof result.data === 'string'
                  ? result.data
                  : JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main modal content ────────────────────────────────────────────────────────

function ExecuteToolForm({
  tool,
  cwd,
  onRunStart,
}: {
  tool: Tool;
  cwd?: string;
  onRunStart: (isRunning: boolean) => void;
}) {
  const executeTool = useExecuteTool();
  const [values, setValues] = useState<Record<string, string>>(() =>
    buildInitialValues(tool.parameters ?? []),
  );
  const [result, setResult] = useState<ToolExecutionResult | null>(null);

  const isShell = tool.name === 'shell_execute';

  useEffect(() => {
    onRunStart(executeTool.isPending);
  }, [executeTool.isPending, onRunStart]);

  const handleRun = () => {
    const parameters = Object.fromEntries(
      (tool.parameters ?? []).map((p) => [p.name, parseValue(values[p.name] ?? '', p.type)]),
    );
    setResult(null);
    executeTool.mutate(
      { toolId: tool.id, parameters, cwd },
      {
        onSuccess: (r) => setResult(r),
        onError: (e) => setResult({ success: false, error: String(e), executionTime: 0 }),
      },
    );
  };

  // For shell_execute: show command input separately, hide cwd param (injected from workspace)
  const shellParams = isShell
    ? (tool.parameters ?? []).filter((p) => p.name !== 'command' && p.name !== 'cwd')
    : null;
  const genericParams = isShell ? shellParams! : (tool.parameters ?? []);

  return (
    <>
      <ScrollArea className="max-h-[65vh] pr-4">
        <div className="space-y-4">
          {/* Shell command input */}
          {isShell && (
            <ShellCommandInput
              value={values['command'] ?? ''}
              cwd={cwd}
              disabled={executeTool.isPending}
              onChange={(v) => setValues((prev) => ({ ...prev, command: v }))}
              onRun={handleRun}
            />
          )}

          {/* Remaining / generic parameters */}
          {genericParams.length === 0 && !isShell && (
            <p className="text-sm text-muted-foreground text-center py-4">
              This tool has no parameters.
            </p>
          )}
          {genericParams.map((p) => (
            <ParameterField
              key={p.name}
              param={p}
              value={values[p.name] ?? ''}
              onChange={(v) => setValues((prev) => ({ ...prev, [p.name]: v }))}
            />
          ))}

          {result && <ExecutionResult result={result} isShell={isShell} />}
        </div>
      </ScrollArea>

      <div className="flex justify-end pt-2">
        <Button
          onClick={handleRun}
          disabled={executeTool.isPending}
          className={
            isShell ? 'gap-2 bg-emerald-600 hover:bg-emerald-700 text-white' : 'gap-2'
          }
        >
          {executeTool.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              {isShell ? (
                <Terminal className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run
            </>
          )}
        </Button>
      </div>
    </>
  );
}

export function ExecuteToolModal({ tool, open, onOpenChange }: ExecuteToolModalProps) {
  const [isPending, setIsPending] = useState(false);
  const getActiveWorkspace = useWorkspaceStore((s) => s.getActiveWorkspace);
  const cwd = getActiveWorkspace()?.nativePath;

  const isShell = tool?.name === 'shell_execute';

  const handleOpenChange = (isOpen: boolean) => {
    if (!isPending) {
      onOpenChange(isOpen);
    }
  };

  if (!tool) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isShell ? (
              <Terminal className="h-4 w-4 text-emerald-500" />
            ) : (
              <Play className="h-4 w-4 text-primary" />
            )}
            Test: {tool.name}
          </DialogTitle>
          {tool.description && (
            <p className="text-sm text-muted-foreground">{tool.description}</p>
          )}
          {!isShell &&
            (cwd ? (
              <p className="text-xs text-muted-foreground font-mono truncate" title={cwd}>
                cwd: {cwd}
              </p>
            ) : (
              <p className="text-xs text-amber-500">
                No workspace selected — cwd will use server default
              </p>
            ))}
        </DialogHeader>

        <ExecuteToolForm
          key={tool.id} // This resets the form state whenever the tool changes
          tool={tool}
          cwd={cwd}
          onRunStart={setIsPending}
        />
      </DialogContent>
    </Dialog>
  );
}
