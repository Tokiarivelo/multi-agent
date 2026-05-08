'use client';

import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X, GripVertical } from 'lucide-react';
import Editor from '@monaco-editor/react';

export interface SwitchCase {
  id: string;
  value: string;
  label: string;
}

interface Props {
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
  theme: string;
}

export function SwitchNodeConfig({ config, onConfigChange, theme }: Props) {
  const cases = (config.cases as SwitchCase[] | undefined) ?? [];

  const addCase = () =>
    onConfigChange('cases', [...cases, { id: uuidv4(), value: '', label: '' }]);

  const removeCase = (id: string) =>
    onConfigChange('cases', cases.filter((c) => c.id !== id));

  const updateCase = (id: string, patch: Partial<SwitchCase>) =>
    onConfigChange(
      'cases',
      cases.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">
          Switch On
          <span className="ml-1.5 text-muted-foreground font-normal">
            — JS expression, result compared to case values
          </span>
        </Label>
        <div className="border border-border/50 rounded-md overflow-hidden bg-background">
          <Editor
            height="60px"
            language="javascript"
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            value={(config.switchOn as string) ?? ''}
            onChange={(v) => onConfigChange('switchOn', v ?? '')}
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              fontFamily:
                'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
              lineNumbers: 'off',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              padding: { top: 8 },
            }}
            loading={null}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Example: <code className="bg-muted px-1 rounded">input.status</code> or{' '}
          <code className="bg-muted px-1 rounded">input.type.toLowerCase()</code>
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Cases</Label>
        <div className="space-y-1.5">
          {cases.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic py-1">No cases defined.</p>
          )}
          {cases.map((c, i) => (
            <div
              key={c.id}
              className="flex items-center gap-1.5 bg-background/60 rounded-md px-2 py-1.5 border border-border/30"
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              <span className="text-[10px] text-amber-500 font-mono shrink-0 w-14">
                case_{i}
              </span>
              <Input
                className="h-6 text-[11px] font-mono flex-1"
                placeholder="value"
                value={c.value}
                onChange={(e) => updateCase(c.id, { value: e.target.value })}
              />
              <Input
                className="h-6 text-[11px] flex-1 text-muted-foreground"
                placeholder="label (optional)"
                value={c.label}
                onChange={(e) => updateCase(c.id, { label: e.target.value })}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-destructive/50 hover:text-destructive shrink-0"
                onClick={() => removeCase(c.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px] gap-1 w-full opacity-60 hover:opacity-100"
          onClick={addCase}
        >
          <Plus className="h-3 w-3" /> Add case
        </Button>
      </div>

      <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400 space-y-1">
        <p className="font-semibold">How to wire it</p>
        <p>
          Each case handle (e.g. <span className="font-mono bg-amber-500/10 px-1 rounded">case_0</span>)
          routes when the value matches.
        </p>
        <p>
          The <span className="font-mono bg-amber-500/10 px-1 rounded">default</span> handle routes
          when no case matches.
        </p>
      </div>
    </div>
  );
}
