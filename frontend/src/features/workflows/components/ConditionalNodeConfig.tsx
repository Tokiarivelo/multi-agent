'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import Editor from '@monaco-editor/react';

interface Props {
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
  theme: string;
}

export function ConditionalNodeConfig({ config, onConfigChange, theme }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">
          Condition
          <span className="ml-1.5 text-muted-foreground font-normal">
            — JS expression evaluated against{' '}
            <code className="bg-muted px-1 rounded">input</code>
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
          Example:{' '}
          <code className="bg-muted px-1 rounded">input.status === &apos;error&apos;</code> or{' '}
          <code className="bg-muted px-1 rounded">input.count &gt; 0</code>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
          <p className="font-semibold mb-0.5">✓ true</p>
          <p className="text-[10px] opacity-70">Condition returned truthy</p>
        </div>
        <div className="rounded-md border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <p className="font-semibold mb-0.5">✗ false</p>
          <p className="text-[10px] opacity-70">Condition returned falsy</p>
        </div>
      </div>
    </div>
  );
}
