'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Editor from '@monaco-editor/react';

interface Props {
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
  theme: string;
}

export function WhileNodeConfig({ config, onConfigChange, theme }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">
          Condition
          <span className="ml-1.5 text-muted-foreground font-normal">
            — JS expression evaluated against <code className="bg-muted px-1 rounded">input</code>
          </span>
        </Label>
        <div className="border border-border/50 rounded-md overflow-hidden bg-background">
          <Editor
            height="80px"
            language="javascript"
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            value={(config.condition as string) ?? ''}
            onChange={(v) => onConfigChange('condition', v ?? '')}
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
          Example: <code className="bg-muted px-1 rounded">input.count &lt; 10</code> or{' '}
          <code className="bg-muted px-1 rounded">input.status !== &apos;done&apos;</code>
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Max Iterations</Label>
        <Input
          type="number"
          min={1}
          max={10000}
          className="h-8 text-sm w-32"
          value={(config.maxIterations as number) ?? 100}
          onChange={(e) => onConfigChange('maxIterations', parseInt(e.target.value, 10) || 100)}
        />
        <p className="text-[10px] text-muted-foreground">
          Safety limit — the loop exits on the &apos;exit&apos; handle when reached.
        </p>
      </div>

      <div className="rounded-md border border-teal-500/20 bg-teal-500/5 px-3 py-2 text-xs text-teal-600 dark:text-teal-400 space-y-1">
        <p className="font-semibold">How to wire it</p>
        <p>
          Connect the <span className="font-mono bg-teal-500/10 px-1 rounded">↻ loop</span> handle
          back to any upstream node to repeat.
        </p>
        <p>
          Connect the <span className="font-mono bg-teal-500/10 px-1 rounded">→ exit</span> handle
          to the next node to continue when the condition is false.
        </p>
      </div>
    </div>
  );
}
