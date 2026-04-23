'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useModels } from '@/features/models/hooks/useModels';
import { useAnalyzeTestOutcome } from '@/features/executions/hooks/useHealing';
import type { FunctionalFailureResult } from '@/features/executions/api/healing.api';
import {
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Wand2,
  ChevronDown,
  ChevronUp,
  Wrench,
  SlidersHorizontal,
  CheckCheck,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TestOutcomePanelProps {
  workflowId: string;
  nodeId: string;
  nodeName?: string;
  nodeType?: string;
  testOutput: unknown;
  testInput?: unknown;
  /** Tool IDs currently assigned to this node (AGENT nodes) */
  currentToolIds?: string[];
  /** All available tools in the workflow (for display names) */
  availableTools?: { id: string; name: string }[];
  /** Called when user applies the suggested config fix (may include toolIds) */
  onApplyFix?: (fixedConfig: Record<string, unknown>) => void;
}

interface AppliedDiff {
  toolsAdded: string[];
  toolsRemoved: string[];
  configKeys: string[];
  fixedConfig: Record<string, unknown>;
}

export function TestOutcomePanel({
  workflowId,
  nodeId,
  nodeName,
  nodeType,
  testOutput,
  testInput,
  currentToolIds = [],
  availableTools = [],
  onApplyFix,
}: TestOutcomePanelProps) {
  const { t } = useTranslation();
  const { data: modelsData } = useModels();
  const models = modelsData?.data ?? [];

  const [modelId, setModelId] = useState('');
  const [result, setResult] = useState<FunctionalFailureResult | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [appliedDiff, setAppliedDiff] = useState<AppliedDiff | null>(null);

  const analyze = useAnalyzeTestOutcome();

  // Derive suggested tool IDs from fixedConfig if present
  const suggestedToolIds: string[] | null =
    result?.fixedConfig?.toolIds && Array.isArray(result.fixedConfig.toolIds)
      ? (result.fixedConfig.toolIds as string[])
      : null;

  // Non-tool config keys suggested
  const nonToolConfigKeys = result?.fixedConfig
    ? Object.keys(result.fixedConfig).filter((k) => k !== 'toolIds')
    : [];

  const toolName = (id: string) =>
    availableTools.find((t) => t.id === id)?.name ?? id;

  const handleAnalyze = async () => {
    setAppliedDiff(null);
    const res = await analyze.mutateAsync({
      workflowId,
      nodeId,
      modelId,
      output: testOutput,
      input: testInput,
      nodeType,
      nodeName,
      prompt: prompt.trim() || undefined,
      currentTools: currentToolIds,
      availableTools,
    });
    setResult(res);
  };

  const handleApplyFix = () => {
    if (!result?.fixedConfig || !onApplyFix) return;

    // Compute the diff before applying
    const diff: AppliedDiff = {
      toolsAdded: suggestedToolIds ? suggestedToolIds.filter((id) => !currentToolIds.includes(id)) : [],
      toolsRemoved: suggestedToolIds ? currentToolIds.filter((id) => !suggestedToolIds.includes(id)) : [],
      configKeys: Object.keys(result.fixedConfig).filter((k) => k !== 'toolIds'),
      fixedConfig: result.fixedConfig,
    };

    onApplyFix(result.fixedConfig);
    setAppliedDiff(diff);
    // Don't clear result — user can still read the AI analysis
  };

  const handleApplyToolsOnly = () => {
    if (!suggestedToolIds || !onApplyFix) return;

    const diff: AppliedDiff = {
      toolsAdded: suggestedToolIds.filter((id) => !currentToolIds.includes(id)),
      toolsRemoved: currentToolIds.filter((id) => !suggestedToolIds.includes(id)),
      configKeys: [],
      fixedConfig: { toolIds: suggestedToolIds },
    };

    onApplyFix({ toolIds: suggestedToolIds });
    setAppliedDiff(diff);
  };

  const handleReset = () => {
    setResult(null);
    setAppliedDiff(null);
  };

  return (
    <div className="mt-3 border-t border-amber-500/20 pt-3 space-y-2">
      {/* ── Model selector ── */}
      <Select
        value={modelId}
        onValueChange={(v) => {
          setModelId(v);
          setResult(null);
          setAppliedDiff(null);
        }}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={t('healing.test.selectModel')} />
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={m.id} value={m.id} className="text-xs">
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* ── Optional custom prompt ── */}
      {modelId && !result && (
        <div>
          <button
            onClick={() => setShowPrompt((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <SlidersHorizontal className="h-3 w-3" />
            {t('healing.test.addPrompt')}
            {showPrompt ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showPrompt && (
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('healing.test.promptPlaceholder')}
              rows={3}
              className="mt-1.5 text-xs resize-none"
            />
          )}
        </div>
      )}

      {/* ── Analyze button ── */}
      {modelId && !result && (
        <Button
          size="sm"
          onClick={handleAnalyze}
          disabled={analyze.isPending}
          className="w-full h-8 gap-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-sm"
        >
          {analyze.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
          {analyze.isPending ? t('healing.test.checking') : t('healing.test.checkOutcome')}
        </Button>
      )}

      {/* ── Error ── */}
      {analyze.isError && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {t('healing.analysisFailed')}
        </div>
      )}

      {/* ── Applied diff banner ── */}
      {appliedDiff && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 space-y-2">
          <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <CheckCheck className="h-3.5 w-3.5" />
            {t('healing.test.fixApplied')}
          </p>

          {/* Tool diff */}
          {(appliedDiff.toolsAdded.length > 0 || appliedDiff.toolsRemoved.length > 0) && (
            <div className="space-y-1">
              {appliedDiff.toolsAdded.map((id) => (
                <div key={id} className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">+</span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                    {toolName(id)}
                  </span>
                  <span className="text-muted-foreground">tool added</span>
                </div>
              ))}
              {appliedDiff.toolsRemoved.map((id) => (
                <div key={id} className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-red-500 font-bold">−</span>
                  <span className="text-red-600 dark:text-red-400 font-medium line-through">
                    {toolName(id)}
                  </span>
                  <span className="text-muted-foreground">tool removed</span>
                </div>
              ))}
            </div>
          )}

          {/* Config key diff */}
          {appliedDiff.configKeys.length > 0 && (
            <div className="space-y-1">
              {appliedDiff.configKeys.map((key) => {
                const newVal = appliedDiff.fixedConfig[key];
                return (
                  <div key={key} className="text-[11px] font-mono">
                    <span className="text-muted-foreground">{key}: </span>
                    <span className="text-emerald-700 dark:text-emerald-300">
                      {JSON.stringify(newVal)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── No failure ── */}
      {result && !result.isFunctionalFailure && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {t('healing.test.taskAccomplished')}
        </div>
      )}

      {/* ── Failure result ── */}
      {result && result.isFunctionalFailure && (
        <div className="space-y-2">
          {/* Confidence bar */}
          <div className="space-y-1">
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  result.confidence >= 0.75
                    ? 'bg-red-500'
                    : result.confidence >= 0.5
                      ? 'bg-amber-500'
                      : 'bg-yellow-400',
                )}
                style={{ width: `${Math.round(result.confidence * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">
              {Math.round(result.confidence * 100)}% confidence
            </span>
          </div>

          {/* Failure reason */}
          <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              {result.failureReason}
            </p>
          </div>

          {/* Suggested action */}
          {result.suggestedAction && (
            <div className="flex items-start gap-2 bg-background border border-border/60 rounded-lg px-3 py-2">
              <Wand2 className="h-3.5 w-3.5 text-violet-500 shrink-0 mt-0.5" />
              <span className="text-xs font-medium">{result.suggestedAction}</span>
            </div>
          )}

          {/* ── Tool suggestion with diff ── */}
          {suggestedToolIds && !appliedDiff && (
            <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 space-y-2">
              <p className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <Wrench className="h-3 w-3" />
                {t('healing.test.suggestedTools')}
              </p>

              {/* Diff rows */}
              <div className="space-y-1">
                {/* Tools to add */}
                {suggestedToolIds
                  .filter((id) => !currentToolIds.includes(id))
                  .map((id) => (
                    <div key={id} className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-emerald-600 font-bold w-3 shrink-0">+</span>
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        {toolName(id)}
                      </span>
                    </div>
                  ))}
                {/* Tools to keep */}
                {suggestedToolIds
                  .filter((id) => currentToolIds.includes(id))
                  .map((id) => (
                    <div key={id} className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-muted-foreground/40 w-3 shrink-0">·</span>
                      <span className="text-muted-foreground">{toolName(id)}</span>
                    </div>
                  ))}
                {/* Tools to remove */}
                {currentToolIds
                  .filter((id) => !suggestedToolIds.includes(id))
                  .map((id) => (
                    <div key={id} className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-red-500 font-bold w-3 shrink-0">−</span>
                      <span className="text-red-600 dark:text-red-400 line-through">
                        {toolName(id)}
                      </span>
                    </div>
                  ))}
              </div>

              {onApplyFix && (
                <Button
                  size="sm"
                  onClick={handleApplyToolsOnly}
                  className="mt-1 h-7 text-[11px] gap-1 w-full bg-sky-600 hover:bg-sky-700 text-white"
                >
                  <Wrench className="h-3 w-3" />
                  {t('healing.test.applyTools')}
                </Button>
              )}
            </div>
          )}

          {/* ── Config changes diff ── */}
          {nonToolConfigKeys.length > 0 && !appliedDiff && (
            <div>
              <button
                onClick={() => setShowConfig((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfig ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {t('healing.configChanges')}
              </button>
              {showConfig && (
                <div className="mt-2 rounded-lg border border-border/60 overflow-hidden text-[11px] font-mono">
                  {nonToolConfigKeys.map((key) => (
                    <div key={key} className="px-3 py-1.5 border-b border-border/40 last:border-0">
                      <span className="text-muted-foreground">{key}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-red-500/70 line-through">
                          {JSON.stringify((testInput as Record<string, unknown>)?.[key] ?? '…')}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {JSON.stringify(result.fixedConfig[key])}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Action buttons ── */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
              className="flex-1 h-8 text-xs font-semibold gap-1.5"
            >
              <RotateCcw className="h-3 w-3" />
              {appliedDiff ? t('healing.reanalyze') : t('healing.dismiss')}
            </Button>
            {onApplyFix &&
              result.strategy !== 'LOG_ONLY' &&
              result.fixedConfig &&
              Object.keys(result.fixedConfig).length > 0 &&
              !appliedDiff && (
                <Button
                  size="sm"
                  onClick={handleApplyFix}
                  className="flex-1 h-8 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {t('healing.test.applyFix')}
                </Button>
              )}
            {appliedDiff && (
              <div className="flex-1 h-8 flex items-center justify-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCheck className="h-3.5 w-3.5" />
                {t('healing.test.fixApplied')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
