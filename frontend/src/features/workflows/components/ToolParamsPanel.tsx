'use client';

import React, { useEffect, useReducer } from 'react';
import { useTranslation } from 'react-i18next';
import { Wrench, Loader2, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toolsApi } from '@/features/tools/api/tools.api';
import type { ToolParameter } from '@/types';

interface ToolParamsPanelProps {
  toolId: string;
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
}

function isTextareaParam(p: ToolParameter): boolean {
  if (p.type === 'object' || p.type === 'array') return true;
  return /template|prompt|content|body|code|script/i.test(p.name);
}

function ParamField({
  param,
  value,
  onChange,
}: {
  param: ToolParameter;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const { t } = useTranslation();
  const required = param.required;
  const badge = required
    ? t('workflows.tool_params.required')
    : t('workflows.tool_params.optional');
  const badgeCls = required
    ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25'
    : 'text-muted-foreground bg-muted/40 border-border/30';

  const defaultHint =
    param.default !== undefined && param.default !== null && param.default !== ''
      ? `${t('workflows.tool_params.default')} ${String(param.default)}`
      : undefined;

  const labelRow = (
    <div className="flex items-center gap-2">
      <Label className="text-xs font-mono">{param.name}</Label>
      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border leading-none ${badgeCls}`}>
        {badge}
      </span>
    </div>
  );

  if (param.type === 'boolean') {
    const checked = value === true || value === 'true';
    return (
      <div className="space-y-1">
        {labelRow}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`tool-param-${param.name}`}
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="accent-primary h-4 w-4 cursor-pointer"
          />
          <label
            htmlFor={`tool-param-${param.name}`}
            className="text-xs text-muted-foreground cursor-pointer select-none"
          >
            {param.description || param.name}
          </label>
        </div>
      </div>
    );
  }

  if (param.type === 'number') {
    return (
      <div className="space-y-1">
        {labelRow}
        {param.description && (
          <p className="text-[10px] text-muted-foreground">{param.description}</p>
        )}
        <Input
          type="number"
          className="h-8 text-xs font-mono"
          placeholder={defaultHint ?? param.name}
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            onChange(isNaN(n) ? '' : n);
          }}
        />
      </div>
    );
  }

  if (isTextareaParam(param)) {
    return (
      <div className="space-y-1">
        {labelRow}
        {param.description && (
          <p className="text-[10px] text-muted-foreground">{param.description}</p>
        )}
        <Textarea
          className="text-xs font-mono min-h-[72px] resize-y"
          placeholder={defaultHint ?? (param.type === 'object' ? '{}' : '[]')}
          value={
            typeof value === 'string'
              ? value
              : value !== undefined && value !== null
                ? JSON.stringify(value, null, 2)
                : ''
          }
          onChange={(e) => {
            onChange(e.target.value);
          }}
          onBlur={(e) => {
            const raw = e.target.value;
            if (param.type === 'object' || param.type === 'array') {
              try {
                onChange(JSON.parse(raw));
              } catch {
                // leave as string if invalid JSON
              }
            }
          }}
        />
      </div>
    );
  }

  // Default: string input
  return (
    <div className="space-y-1">
      {labelRow}
      {param.description && (
        <p className="text-[10px] text-muted-foreground">{param.description}</p>
      )}
      <Input
        className="h-8 text-xs font-mono"
        placeholder={defaultHint ?? param.name}
        value={value !== undefined && value !== null ? String(value) : ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

type FetchState = { loading: boolean; error: string | null; params: ToolParameter[] };
type FetchAction =
  | { type: 'SUCCESS'; params: ToolParameter[] }
  | { type: 'ERROR'; error: string }
  | { type: 'DONE' };

function fetchReducer(_: FetchState, action: FetchAction): FetchState {
  if (action.type === 'SUCCESS') return { loading: false, error: null, params: action.params };
  if (action.type === 'ERROR') return { loading: false, error: action.error, params: [] };
  return { loading: true, error: null, params: [] };
}

export function ToolParamsPanel({ toolId, config, onConfigChange }: ToolParamsPanelProps) {
  const { t } = useTranslation();
  const [{ params, loading, error }, dispatch] = useReducer(fetchReducer, {
    loading: false,
    error: null,
    params: [],
  });

  useEffect(() => {
    if (!toolId) return;
    dispatch({ type: 'DONE' });
    toolsApi
      .getById(toolId)
      .then((tool) => dispatch({ type: 'SUCCESS', params: tool.parameters ?? [] }))
      .catch(() => dispatch({ type: 'ERROR', error: t('workflows.tool_params.fetch_error') }));
  }, [toolId, t]);

  if (!toolId) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t('workflows.tool_params.loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive py-1">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        {error}
      </div>
    );
  }

  if (params.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground italic py-1">
        {t('workflows.tool_params.no_params')}
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/80 flex items-center gap-1.5">
        <Wrench className="h-3 w-3" />
        {t('workflows.tool_params.title')}
      </p>
      {params.map((param) => (
        <ParamField
          key={param.name}
          param={param}
          value={config[param.name]}
          onChange={(v) => onConfigChange(param.name, v)}
        />
      ))}
    </div>
  );
}
