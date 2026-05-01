'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { v4 as uuidv4 } from 'uuid';
import Editor from '@monaco-editor/react';
import {
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Maximize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { workflowsApi } from '../api/workflows.api';
import { useWorkflowExecutionStore } from '../store/workflowExecution.store';
import { useWorkflowLogs } from '../hooks/useWorkflowLogs';
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore';
import { StructuredDataViewer } from './StructuredDataViewer';
import { TestOutcomePanel } from './TestOutcomePanel';
import { FullscreenDataModal } from './FullscreenDataModal';

interface TestNodePanelProps {
  workflowId: string;
  nodeId: string | null;
  type: string;
  config: Record<string, unknown>;
  customName?: string;
  initialTestInput?: string;
  availableTools?: { id: string; name: string }[];
  onApplyFix: (fixedConfig: Record<string, unknown>) => void;
}

interface TestResult {
  input?: unknown;
  output?: unknown;
  error?: string | null;
  logs?: string[];
}

export function TestNodePanel({
  workflowId,
  nodeId,
  type,
  config,
  customName,
  initialTestInput,
  availableTools = [],
  onApplyFix,
}: TestNodePanelProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();

  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [testInput, setTestInput] = useState<string>(initialTestInput || '{}');
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [currentTestExecId, setCurrentTestExecId] = useState<string | null>(null);
  const [outputExpanded, setOutputExpanded] = useState(false);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const [fullscreenContent, setFullscreenContent] = useState<{ title: string; data: unknown } | null>(null);

  // Subscribe to WebSocket room for the active test execution
  useWorkflowLogs({ executionId: currentTestExecId });

  // Live token progress
  const testLiveTokens = useWorkflowExecutionStore((s) =>
    nodeId ? s.nodeTokenProgress[nodeId] : undefined,
  );

  const handleCopyTestLog = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLogId(id);
    setTimeout(() => setCopiedLogId(null), 2000);
  };

  const runTest = async () => {
    if (!workflowId) return;
    const apiNodeId = nodeId ?? uuidv4();
    const activeExecId = uuidv4();
    
    setCurrentTestExecId(activeExecId);
    setTestRunning(true);
    setTestResult(null);

    try {
      let parsedInput: Record<string, unknown> = {};
      try {
        parsedInput = JSON.parse(testInput);
      } catch {
        parsedInput = {};
      }

      const activeWs = useWorkspaceStore.getState().getActiveWorkspace?.() ?? null;
      if (activeWs?.nativePath && !parsedInput.cwd) {
        parsedInput.cwd = activeWs.nativePath;
      }

      const result = await workflowsApi.testNode(
        workflowId,
        apiNodeId,
        parsedInput,
        type,
        config,
        activeExecId,
      );

      setTestResult(result);
    } catch (err) {
      setTestResult({
        input: testInput,
        output: null,
        error: err instanceof Error ? err.message : 'Unknown error',
        logs: [],
      });
    } finally {
      setTestRunning(false);
      setCurrentTestExecId(null);
    }
  };

  return (
    <div className="border-t border-border/50 bg-muted/10 shrink-0 flex flex-col min-h-0">
      {fullscreenContent && (
        <FullscreenDataModal
          open
          onClose={() => setFullscreenContent(null)}
          title={fullscreenContent.title}
          data={fullscreenContent.data}
        />
      )}
      <Collapsible open={testPanelOpen} onOpenChange={setTestPanelOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between text-xs h-9 px-4 font-medium rounded-none hover:bg-muted/50"
          >
            <span className="flex items-center gap-2">
              <Play className="h-3.5 w-3.5 text-emerald-500" />
              {t('healing.test.panelTitle')}
              {initialTestInput && !testResult && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 font-normal">
                  {t('healing.test.prefilled')}
                </span>
              )}
            </span>
            {testResult &&
              (testResult.error ? (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-3 w-3" /> {t('healing.test.status.failed')}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-500">
                  <CheckCircle2 className="h-3 w-3" /> {t('healing.test.status.passed')}
                </span>
              ))}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="overflow-y-auto max-h-[55vh] px-4 pt-3 pb-4 space-y-3 animate-in slide-in-from-top-1">
            {/* Input Editor */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{t('healing.test.manualInput')}</Label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-60 hover:opacity-100 transition-opacity"
                  title={t('workflows.fullscreen.viewFullscreen')}
                  onClick={() => {
                    let parsed: unknown = testInput;
                    try { parsed = JSON.parse(testInput); } catch { /* keep as string */ }
                    setFullscreenContent({ title: t('healing.test.manualInput'), data: parsed });
                  }}
                >
                  <Maximize2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="border border-border/50 rounded-md overflow-hidden">
                <Editor
                  key={initialTestInput}
                  height="120px"
                  language="json"
                  theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                  defaultValue={testInput}
                  onChange={(val) => setTestInput(val ?? '{}')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 11,
                    lineNumbersMinChars: 2,
                    padding: { top: 8 },
                    scrollBeyondLastLine: false,
                    formatOnPaste: true,
                    formatOnType: false,
                    automaticLayout: true,
                    wordWrap: 'on',
                  }}
                />
              </div>
            </div>

            <Button
              size="sm"
              onClick={runTest}
              disabled={testRunning}
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {testRunning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('healing.test.running')}
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" /> {t('healing.test.runNode')}
                </>
              )}
            </Button>

            {/* Live token counter */}
            {testRunning && testLiveTokens && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono px-1">
                <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                <span className="text-primary font-semibold">
                  {testLiveTokens.totalTokens.toLocaleString()} tok
                </span>
                <span>
                  ↑{testLiveTokens.inputTokens.toLocaleString()} ↓
                  {testLiveTokens.outputTokens.toLocaleString()}
                </span>
                {testLiveTokens.iteration > 0 && (
                  <span className="text-muted-foreground/60">
                    iter {testLiveTokens.iteration}
                  </span>
                )}
              </div>
            )}

            {/* Result */}
            {testResult && (
              <div className="space-y-2">
                <div
                  className={cn(
                    'rounded-md border p-3 text-xs font-mono relative group/output transition-all duration-200',
                    testResult.error
                      ? 'border-destructive/40 bg-destructive/5 text-destructive'
                      : 'border-emerald-500/30 bg-emerald-500/5',
                    !outputExpanded && 'max-h-40 overflow-auto',
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-muted-foreground flex items-center gap-2">
                      {testResult.error ? (
                        <>
                          <XCircle className="h-3.5 w-3.5" />
                          <span>{t('healing.category.other')}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          <span>{t('healing.test.output')}</span>
                        </>
                      )}
                    </p>
                    {!testResult.error && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-60 hover:opacity-100 transition-opacity"
                          title={t('workflows.fullscreen.viewFullscreen')}
                          onClick={() =>
                            setFullscreenContent({
                              title: t('healing.test.output'),
                              data: testResult.output,
                            })
                          }
                        >
                          <Maximize2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] gap-1 opacity-60 hover:opacity-100 transition-opacity"
                          onClick={() => setOutputExpanded(!outputExpanded)}
                        >
                          {outputExpanded ? (
                            <>
                              <ChevronUp className="h-3 w-3" />
                              {t('common.collapse', 'Collapse')}
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3" />
                              {t('common.expand', 'Expand')}
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className={cn('w-full', testResult.error ? 'text-destructive font-mono text-sm' : 'mt-2')}>
                    {testResult.error ? (
                      <pre className="whitespace-pre-wrap break-all">{testResult.error}</pre>
                    ) : (
                      <StructuredDataViewer data={testResult.output} />
                    )}
                  </div>
                </div>

                {/* Logs */}
                {testResult.logs && testResult.logs.length > 0 && (
                  <div className="rounded-md border border-border/40 bg-muted/30 p-3 text-xs font-mono overflow-auto max-h-48 space-y-0.5 relative group/logs">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-muted-foreground tracking-wide uppercase text-[10px]">
                        {t('healing.test.logs.title')}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] gap-1 opacity-0 group-hover/logs:opacity-100 transition-opacity"
                        onClick={() => handleCopyTestLog(testResult.logs?.join('\n') || '', 'all')}
                      >
                        {copiedLogId === 'all' ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        {t('healing.test.logs.copyAll')}
                      </Button>
                    </div>
                    {testResult.logs?.map((log: string, i: number) => {
                      const isConsoleError = log.startsWith('[ERROR]');
                      const isConsoleWarn = log.startsWith('[WARN]');
                      const isConsoleLog = log.startsWith('[LOG]');
                      const isConsoleInfo = log.startsWith('[INFO]');
                      const isConsoleDebug = log.startsWith('[DEBUG]');

                      return (
                        <div
                          key={i}
                          className={cn(
                            'flex items-start gap-2 py-1 px-2 rounded-sm border-l-2 relative group/item transition-colors',
                            isConsoleError
                              ? 'bg-red-500/5 border-red-500/50 text-red-500 dark:text-red-400'
                              : isConsoleWarn
                                ? 'bg-amber-500/5 border-amber-500/50 text-amber-600 dark:text-amber-400'
                                : isConsoleLog || isConsoleInfo
                                  ? 'bg-sky-500/5 border-sky-500/50 text-sky-600 dark:text-sky-400'
                                  : isConsoleDebug
                                    ? 'bg-violet-500/5 border-violet-500/50 text-violet-500 dark:text-violet-400'
                                    : 'bg-muted/10 border-muted-foreground/30 text-muted-foreground',
                          )}
                        >
                          <span className="font-mono text-[9px] uppercase font-bold shrink-0 w-8 opacity-70 mt-0.5">
                            {isConsoleError
                              ? 'ERR'
                              : isConsoleWarn
                                ? 'WRN'
                                : isConsoleLog
                                  ? 'LOG'
                                  : isConsoleInfo
                                    ? 'INF'
                                    : isConsoleDebug
                                      ? 'DBG'
                                      : t('healing.test.logs.system')}
                          </span>
                          <span className="break-all flex-1 pr-6 leading-relaxed">
                            {log.replace(/^\[(ERROR|WARN|LOG|INFO|DEBUG)\]\s*/, '')}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 absolute right-1 top-1 opacity-0 group-hover/item:opacity-100 transition-opacity bg-background/40 hover:bg-background/80"
                            onClick={() => handleCopyTestLog(log, `log-${i}`)}
                            title={t('healing.test.logs.copyEntry')}
                          >
                            {copiedLogId === `log-${i}` ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* AI outcome check */}
                {!testResult.error && workflowId && (
                  <TestOutcomePanel
                    workflowId={workflowId}
                    nodeId={nodeId ?? 'unsaved'}
                    nodeName={customName ?? type}
                    nodeType={type}
                    testOutput={testResult.output}
                    testInput={testResult.input}
                    currentNodeConfig={config as Record<string, unknown>}
                    currentToolIds={(config.toolIds as string[]) ?? []}
                    availableTools={availableTools}
                    onApplyFix={onApplyFix}
                  />
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
