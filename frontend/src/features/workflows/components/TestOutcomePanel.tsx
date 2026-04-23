'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TestOutcomePanelProps {
  workflowId: string;
  nodeId: string;
  nodeName?: string;
  nodeType?: string;
  testOutput: unknown;
  testInput?: unknown;
  /** Called when user applies the suggested config fix */
  onApplyFix?: (fixedConfig: Record<string, unknown>) => void;
}

export function TestOutcomePanel({
  workflowId,
  nodeId,
  nodeName,
  nodeType,
  testOutput,
  testInput,
  onApplyFix,
}: TestOutcomePanelProps) {
  const { t } = useTranslation();
  const { data: modelsData } = useModels();
  const models = modelsData?.data ?? [];
  const [modelId, setModelId] = useState('');
  const [result, setResult] = useState<FunctionalFailureResult | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const analyze = useAnalyzeTestOutcome();

  const handleAnalyze = async () => {
    const res = await analyze.mutateAsync({
      workflowId,
      nodeId,
      modelId,
      output: testOutput,
      input: testInput,
      nodeType,
      nodeName,
    });
    setResult(res);
  };

  return (
    <div className="mt-3 border-t border-amber-500/20 pt-3 space-y-2">
      {/* Model selector */}
      <Select value={modelId} onValueChange={(v) => { setModelId(v); setResult(null); }}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={t('healing.test.selectModel')} />
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {modelId && !result && (
        <Button
          size="sm"
          onClick={handleAnalyze}
          disabled={analyze.isPending}
          className="w-full h-8 gap-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-sm"
        >
          {analyze.isPending
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Search className="h-3.5 w-3.5" />}
          {analyze.isPending ? t('healing.test.checking') : t('healing.test.checkOutcome')}
        </Button>
      )}

      {analyze.isError && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {t('healing.analysisFailed')}
        </div>
      )}

      {result && !result.isFunctionalFailure && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {t('healing.test.taskAccomplished')}
        </div>
      )}

      {result && result.isFunctionalFailure && (
        <div className="space-y-2">
          {/* Confidence bar */}
          <div className="space-y-1">
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  result.confidence >= 0.75 ? 'bg-red-500' : result.confidence >= 0.5 ? 'bg-amber-500' : 'bg-yellow-400',
                )}
                style={{ width: `${Math.round(result.confidence * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{Math.round(result.confidence * 100)}% confidence</span>
          </div>

          {/* Failure reason */}
          <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{result.failureReason}</p>
          </div>

          {/* Suggested action */}
          {result.suggestedAction && (
            <div className="flex items-start gap-2 bg-background border border-border/60 rounded-lg px-3 py-2">
              <Wand2 className="h-3.5 w-3.5 text-violet-500 shrink-0 mt-0.5" />
              <span className="text-xs font-medium">{result.suggestedAction}</span>
            </div>
          )}

          {/* Config changes */}
          {result.fixedConfig && Object.keys(result.fixedConfig).length > 0 && (
            <div>
              <button
                onClick={() => setShowConfig((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfig ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {t('healing.configChanges')}
              </button>
              {showConfig && (
                <pre className="mt-2 p-3 bg-background border border-border/60 rounded-lg text-[11px] font-mono overflow-auto leading-relaxed text-emerald-700 dark:text-emerald-400">
                  {JSON.stringify(result.fixedConfig, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setResult(null)}
              className="flex-1 h-8 text-xs font-semibold"
            >
              {t('healing.dismiss')}
            </Button>
            {onApplyFix && result.strategy !== 'LOG_ONLY' && result.fixedConfig && Object.keys(result.fixedConfig).length > 0 && (
              <Button
                size="sm"
                onClick={() => { onApplyFix(result.fixedConfig); setResult(null); }}
                className="flex-1 h-8 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                <CheckCircle2 className="h-3 w-3" />
                {t('healing.test.applyFix')}
              </Button>
            )}
          </div>

          {/* Re-analyze */}
          <button
            onClick={() => setResult(null)}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            {t('healing.reanalyze')}
          </button>
        </div>
      )}
    </div>
  );
}
