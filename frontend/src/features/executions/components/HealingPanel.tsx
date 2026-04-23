'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useModels } from '@/features/models/hooks/useModels';
import {
  useAnalyzeExecution,
  useAnalyzeOutcome,
  useApplyFix,
  useRejectFix,
} from '../hooks/useHealing';
import type { HealingAnalysisResult, FunctionalFailureResult, HealingStrategy } from '../api/healing.api';
import {
  Wand2,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const STRATEGY_COLORS: Record<HealingStrategy, string> = {
  AUTO_FIX: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  MANUAL_APPROVAL: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  LOG_ONLY: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground">{pct}% confidence</span>
    </div>
  );
}

// ─── Technical failure panel (node crashed) ───────────────────────────────────

interface TechnicalPanelProps {
  executionId: string;
  modelId: string;
}

function TechnicalPanel({ executionId, modelId }: TechnicalPanelProps) {
  const { t } = useTranslation();
  const [result, setResult] = useState<HealingAnalysisResult | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const analyze = useAnalyzeExecution();
  const applyFix = useApplyFix();
  const rejectFix = useRejectFix();

  const handleAnalyze = async () => {
    const res = await analyze.mutateAsync({ executionId, modelId });
    setResult(res);
  };

  return (
    <div className="space-y-3">
      {!result && (
        <Button
          size="sm"
          onClick={handleAnalyze}
          disabled={analyze.isPending}
          className="w-full h-9 gap-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-sm"
        >
          {analyze.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          {analyze.isPending ? t('healing.analyzing') : t('healing.analyze')}
        </Button>
      )}

      {analyze.isError && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {t('healing.analysisFailed')}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs font-semibold truncate">{result.failedNodeName}</span>
            <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0', STRATEGY_COLORS[result.suggestion.strategy])}>
              {t(`healing.strategy.${result.suggestion.strategy}`)}
            </span>
          </div>

          <ConfidenceBar value={result.suggestion.confidence} />

          <p className="text-xs text-muted-foreground leading-relaxed">{result.suggestion.explanation}</p>

          <div className="flex items-start gap-2 bg-background border border-border/60 rounded-lg px-3 py-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
            <span className="text-xs font-medium">{result.suggestion.fixSummary}</span>
          </div>

          {Object.keys(result.suggestion.fixedConfig).length > 0 && (
            <div>
              <button onClick={() => setShowConfig(v => !v)} className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
                {showConfig ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {t('healing.configChanges')}
              </button>
              {showConfig && (
                <pre className="mt-2 p-3 bg-background border border-border/60 rounded-lg text-[11px] font-mono overflow-auto leading-relaxed text-emerald-700 dark:text-emerald-400">
                  {JSON.stringify(result.suggestion.fixedConfig, null, 2)}
                </pre>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {result.suggestion.strategy !== 'LOG_ONLY' && (
              <Button size="sm" onClick={() => applyFix.mutate({ executionId, healingLogId: result.healingLogId, modelId })} disabled={applyFix.isPending}
                className="flex-1 h-8 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                {applyFix.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                {applyFix.isPending ? t('healing.applying') : t('healing.applyAndRetry')}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => { rejectFix.mutate({ executionId, healingLogId: result.healingLogId }); setResult(null); }}
              disabled={rejectFix.isPending}
              className="flex-1 h-8 gap-1.5 text-xs font-semibold border-destructive/30 text-destructive hover:bg-destructive hover:text-white">
              <XCircle className="h-3 w-3" />{t('healing.dismiss')}
            </Button>
          </div>

          <button onClick={() => setResult(null)} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
            {t('healing.reanalyze')}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Functional failure panel (completed but task not done) ───────────────────

interface FunctionalPanelProps {
  executionId: string;
  modelId: string;
}

function FunctionalPanel({ executionId, modelId }: FunctionalPanelProps) {
  const { t } = useTranslation();
  const [result, setResult] = useState<FunctionalFailureResult | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const analyze = useAnalyzeOutcome();
  const rejectFix = useRejectFix();

  const handleAnalyze = async () => {
    const res = await analyze.mutateAsync({ executionId, modelId });
    setResult(res);
  };

  return (
    <div className="space-y-3">
      {!result && (
        <Button
          size="sm"
          onClick={handleAnalyze}
          disabled={analyze.isPending}
          className="w-full h-9 gap-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-sm"
        >
          {analyze.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          {analyze.isPending ? t('healing.functional.analyzing') : t('healing.functional.analyze')}
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
          {t('healing.functional.taskAccomplished')}
        </div>
      )}

      {result && result.isFunctionalFailure && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs font-semibold truncate">{result.failedNodeName}</span>
            <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0', STRATEGY_COLORS[result.strategy])}>
              {t(`healing.strategy.${result.strategy}`)}
            </span>
          </div>

          <ConfidenceBar value={result.confidence} />

          <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{result.failureReason}</p>
          </div>

          {result.suggestedAction && (
            <div className="flex items-start gap-2 bg-background border border-border/60 rounded-lg px-3 py-2">
              <Wand2 className="h-3.5 w-3.5 text-violet-500 shrink-0 mt-0.5" />
              <span className="text-xs font-medium">{result.suggestedAction}</span>
            </div>
          )}

          {result.fixedConfig && Object.keys(result.fixedConfig).length > 0 && (
            <div>
              <button onClick={() => setShowConfig(v => !v)} className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
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

          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline"
              onClick={() => { if (result.healingLogId) rejectFix.mutate({ executionId, healingLogId: result.healingLogId }); setResult(null); }}
              className="flex-1 h-8 gap-1.5 text-xs font-semibold">
              <XCircle className="h-3 w-3" />{t('healing.dismiss')}
            </Button>
          </div>

          <button onClick={() => setResult(null)} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
            {t('healing.reanalyze')}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main HealingPanel (shown in ExecutionDetails) ────────────────────────────

interface HealingPanelProps {
  executionId: string;
  /** 'failed' shows technical failure analysis; 'completed' shows functional failure check */
  executionStatus: string;
}

export function HealingPanel({ executionId, executionStatus }: HealingPanelProps) {
  const { t } = useTranslation();
  const { data: modelsData } = useModels();
  const [selectedModelId, setSelectedModelId] = useState('');
  const models = modelsData?.data ?? [];

  const isFailed = executionStatus === 'failed' || executionStatus === 'FAILED';
  const isCompleted = executionStatus === 'completed' || executionStatus === 'COMPLETED';

  if (!isFailed && !isCompleted) return null;

  return (
    <Card className={cn('shadow-sm', isFailed ? 'border-violet-500/20 bg-violet-500/5' : 'border-amber-500/20 bg-amber-500/5')}>
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-center gap-2.5">
          <div className={cn('p-1.5 rounded-lg', isFailed ? 'bg-violet-500/10 text-violet-500' : 'bg-amber-500/10 text-amber-600')}>
            {isFailed ? <Wand2 className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </div>
          <CardTitle className={cn('text-sm font-semibold', isFailed ? 'text-violet-700 dark:text-violet-400' : 'text-amber-700 dark:text-amber-400')}>
            {isFailed ? t('healing.title') : t('healing.functional.title')}
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {isFailed ? t('healing.description') : t('healing.functional.description')}
        </p>
      </CardHeader>

      <CardContent className="px-5 pb-5 space-y-4">
        <Select value={selectedModelId} onValueChange={setSelectedModelId}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder={t('healing.selectModel')} />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedModelId && isFailed && (
          <TechnicalPanel executionId={executionId} modelId={selectedModelId} />
        )}
        {selectedModelId && isCompleted && (
          <FunctionalPanel executionId={executionId} modelId={selectedModelId} />
        )}

        {!selectedModelId && (
          <p className="text-[11px] text-muted-foreground text-center py-1">{t('healing.selectModelFirst')}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Small badge shown in execution logs when an auto-fix was applied ─────────

export function HealingBadge({ type = 'TECHNICAL' }: { type?: 'TECHNICAL' | 'FUNCTIONAL' }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={cn('gap-1 text-[10px] font-semibold px-1.5 py-0',
      type === 'FUNCTIONAL'
        ? 'border-amber-500/30 text-amber-600 bg-amber-500/5'
        : 'border-emerald-500/30 text-emerald-600 bg-emerald-500/5',
    )}>
      {type === 'FUNCTIONAL' ? <AlertTriangle className="h-2.5 w-2.5" /> : <Wand2 className="h-2.5 w-2.5" />}
      {type === 'FUNCTIONAL' ? t('healing.functional.badge') : t('healing.autoFixed')}
    </Badge>
  );
}
