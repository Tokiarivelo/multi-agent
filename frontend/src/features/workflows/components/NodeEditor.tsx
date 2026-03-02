'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import {
  X,
  Maximize2,
  Minimize2,
  Code2,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  GitFork,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { NODE_TYPE_REGISTRY, NodeTypeMeta, NodeTypeId } from './nodeTypes';
import { AddNodePayload, workflowsApi } from '../api/workflows.api';
import { v4 as uuidv4 } from 'uuid';
import { useTheme } from 'next-themes';
import Editor from '@monaco-editor/react';
import { Resizable } from 're-resizable';
import { FileConfigEditor } from './FileConfigEditor';

export interface NodeEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (node: AddNodePayload) => void;
  /** Existing node to edit (undefined → create) */
  initialNode?: {
    id: string;
    type: NodeTypeId | string;
    customName?: string;
    config?: Record<string, unknown>;
    position?: { x: number; y: number };
  };
  defaultPosition?: { x: number; y: number };
  isSaving?: boolean;
  /** Existing agents for AGENT node dropdown */
  agents?: { id: string; name: string }[];
  /** Existing tools for TOOL node dropdown  */
  tools?: { id: string; name: string }[];
  /** TS interfaces of previous node outputs passed in for Monaco autocomplete */
  availableTypings?: string;
  /** Workflow ID — required for node test feature */
  workflowId?: string;
  /** Pre-fill the Test Node input with this data (from last execution) */
  initialTestInput?: Record<string, unknown>;
}

/** Inner form — keyed on `initialNode` so it remounts (and resets) cleanly */
function NodeEditorForm({
  open,
  onClose,
  onSave,
  initialNode,
  defaultPosition,
  isSaving,
  agents = [],
  tools = [],
  availableTypings,
  workflowId,
  initialTestInput,
}: NodeEditorProps) {
  const { t, i18n } = useTranslation();
  const { resolvedTheme } = useTheme();

  const isEdit = !!initialNode?.id;

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [type, setType] = useState<NodeTypeId>((initialNode?.type as NodeTypeId) ?? 'AGENT');
  const [config, setConfig] = useState<Record<string, unknown>>(initialNode?.config ?? {});
  const [customName, setCustomName] = useState<string>(initialNode?.customName ?? '');

  // Test Node state
  const [testInput, setTestInput] = useState<string>(
    initialTestInput ? JSON.stringify(initialTestInput, null, 2) : '{}',
  );
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{
    input: unknown;
    output: unknown;
    error?: string;
    logs: string[];
  } | null>(null);
  // Auto-expand Test Node panel if we have pre-filled input from last run
  const [testPanelOpen, setTestPanelOpen] = useState(!!initialTestInput);

  const runTest = async () => {
    if (!workflowId || !initialNode?.id) return;
    setTestRunning(true);
    setTestResult(null);
    try {
      let parsedInput: Record<string, unknown> = {};
      try {
        parsedInput = JSON.parse(testInput);
      } catch {
        parsedInput = {};
      }
      const result = await workflowsApi.testNode(workflowId, initialNode.id, parsedInput);

      // Forward captured sandbox console.* calls to the real browser DevTools console
      const nodeLabel = `[Node: ${initialNode.customName ?? initialNode.type ?? initialNode.id}]`;
      result.logs.forEach((line) => {
        if (line.startsWith('[ERROR]')) {
          console.error(nodeLabel, line.replace(/^\[ERROR\]\s*/, ''));
        } else if (line.startsWith('[WARN]')) {
          console.warn(nodeLabel, line.replace(/^\[WARN\]\s*/, ''));
        } else if (
          line.startsWith('[LOG]') ||
          line.startsWith('[INFO]') ||
          line.startsWith('[DEBUG]')
        ) {
          console.log(nodeLabel, line.replace(/^\[\w+\]\s*/, ''));
        }
      });

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
    }
  };

  const meta: NodeTypeMeta = NODE_TYPE_REGISTRY.find((n) => n.id === type) ?? NODE_TYPE_REGISTRY[0];

  const handleTypeChange = (t: NodeTypeId) => {
    setType(t);
    setConfig(meta.defaultConfig);
  };

  const handleConfigChange = (key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const insertVariable = (variable: string) => {
    if (editorRef.current) {
      editorRef.current.trigger('keyboard', 'type', { text: variable });
    }
  };

  // Inject Typescript definitions from earlier nodes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditorBeforeMount = (monaco: any) => {
    if (availableTypings) {
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
      });

      // Provide the pre-computed TS interface typings to the global monaco TS engine
      monaco.languages.typescript.javascriptDefaults.addExtraLib(
        availableTypings,
        'ts:filename/context.d.ts',
      );
    }
  };

  const handleSave = () => {
    onSave({
      id: initialNode?.id ?? uuidv4(),
      type,
      customName: customName.trim() || undefined,
      config,
      position: initialNode?.position ?? defaultPosition ?? { x: 100, y: 100 },
    });
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed top-4 right-4 z-50 h-[calc(100%-2rem)] flex flex-col pointer-events-auto shadow-2xl animate-in slide-in-from-right-8 duration-300"
      onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
    >
      <Resizable
        defaultSize={{
          width: 400,
          height: '100%',
        }}
        minWidth={320}
        maxWidth={800}
        enable={{ left: true }}
        className="flex flex-col h-full"
      >
        <Card className="flex flex-col h-full bg-card/85 backdrop-blur-xl border border-border/50 shadow-none overflow-hidden rounded-2xl">
          <CardHeader className="flex-row items-center justify-between border-b border-border/50 py-4 shadow-sm">
            <CardTitle className="flex items-center gap-2 text-base">
              <meta.icon className={`h-5 w-5 ${meta.color}`} />
              {isEdit
                ? t('workflows.node_editor.edit', {
                    label: i18n.language.startsWith('fr') ? meta.labelFr : meta.label,
                  })
                : t('workflows.node_editor.add', {
                    label: i18n.language.startsWith('fr') ? meta.labelFr : meta.label,
                  })}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Node type selector — only for create */}
            {!isEdit && (
              <div className="space-y-2">
                <Label>{t('workflows.node_editor.nodeType')}</Label>
                <Select value={type} onValueChange={(v) => handleTypeChange(v as NodeTypeId)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NODE_TYPE_REGISTRY.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        <span className="flex items-center gap-2">
                          <n.icon className={`h-4 w-4 ${n.color}`} />
                          {i18n.language.startsWith('fr') ? n.labelFr : n.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {i18n.language.startsWith('fr') ? meta.descriptionFr : meta.description}
                </p>
              </div>
            )}

            {/* Custom Name Override */}
            <div className="space-y-2">
              <Label>{t('workflows.node_editor.customName') || 'Custom Name'}</Label>
              <Input
                placeholder={
                  t('workflows.node_editor.customNamePlaceholder') || 'e.g. Code Reviewer'
                }
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </div>

            {/* AGENT config */}
            {type === 'AGENT' && (
              <div className="space-y-2">
                <Label>{t('workflows.node_editor.agent')}</Label>
                {agents.length > 0 ? (
                  <Select
                    value={(config.agentId as string) ?? ''}
                    onValueChange={(v) => handleConfigChange('agentId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('workflows.node_editor.selectAgent')} />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder={t('workflows.node_editor.agentId')}
                    value={(config.agentId as string) ?? ''}
                    onChange={(e) => handleConfigChange('agentId', e.target.value)}
                  />
                )}
              </div>
            )}

            {/* TOOL config */}
            {type === 'TOOL' && (
              <div className="space-y-2">
                <Label>{t('workflows.node_editor.tool')}l</Label>
                {tools.length > 0 ? (
                  <Select
                    value={(config.toolId as string) ?? ''}
                    onValueChange={(v) => handleConfigChange('toolId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('workflows.node_editor.selectTool')} />
                    </SelectTrigger>
                    <SelectContent>
                      {tools.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder={t('workflows.node_editor.toolId')}
                    value={(config.toolId as string) ?? ''}
                    onChange={(e) => handleConfigChange('toolId', e.target.value)}
                  />
                )}
              </div>
            )}

            {/* CONDITIONAL config */}
            {type === 'CONDITIONAL' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{t('workflows.node_editor.condition')}</Label>
                  <Select
                    value={(config.language as string) || 'javascript'}
                    onValueChange={(v) => handleConfigChange('language', v)}
                  >
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="javascript">JavaScript</SelectItem>
                      <SelectItem value="python">Python</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div
                  className={
                    isFullscreen
                      ? 'fixed inset-0 z-999 bg-background flex flex-col p-8 animate-in fade-in duration-200'
                      : 'border border-border/50 rounded-md overflow-hidden bg-background relative group'
                  }
                >
                  {isFullscreen && (
                    <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-4">
                      <div className="flex items-center gap-4">
                        <Label className="text-lg font-semibold">
                          {t('workflows.node_editor.condition')}
                        </Label>
                        <Select
                          value={(config.language as string) || 'javascript'}
                          onValueChange={(v) => handleConfigChange('language', v)}
                        >
                          <SelectTrigger className="w-[130px] h-8 text-xs">
                            <SelectValue placeholder="Language" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="javascript">JavaScript</SelectItem>
                            <SelectItem value="python">Python</SelectItem>
                            <SelectItem value="json">JSON</SelectItem>
                            <SelectItem value="text">Text</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button variant="outline" onClick={() => setIsFullscreen(false)}>
                        <Minimize2 className="h-4 w-4 mr-2" /> Exit Fullscreen
                      </Button>
                    </div>
                  )}
                  {!isFullscreen && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute bottom-2 right-6 z-10 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border/50 text-muted-foreground hover:text-foreground"
                      onClick={() => setIsFullscreen(true)}
                    >
                      <Maximize2 className="h-3 w-3" />
                    </Button>
                  )}
                  <div className="flex-1 relative min-h-0 border border-border/20 rounded-sm">
                    <Editor
                      height={isFullscreen ? '100%' : '160px'}
                      language={(config.language as string) || 'javascript'}
                      theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                      value={(config.condition as string) ?? ''}
                      onChange={(val: string | undefined) =>
                        handleConfigChange('condition', val || '')
                      }
                      options={{
                        minimap: { enabled: false },
                        fontSize: 12,
                        fontFamily:
                          'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
                        formatOnPaste: true,
                        formatOnType: true,
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        lineNumbersMinChars: 3,
                        padding: { top: 12 },
                      }}
                      beforeMount={handleEditorBeforeMount}
                      loading={
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground animate-pulse py-8">
                          Loading Editor...
                        </div>
                      }
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('workflows.node_editor.conditionDesc')}
                </p>
              </div>
            )}

            {/* TRANSFORM config */}
            {type === 'TRANSFORM' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{t('workflows.node_editor.transform')}</Label>
                  <Select
                    value={(config.language as string) || 'json'}
                    onValueChange={(v) => handleConfigChange('language', v)}
                  >
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="javascript">JavaScript</SelectItem>
                      <SelectItem value="python">Python</SelectItem>
                      <SelectItem value="yaml">YAML</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div
                  className={
                    isFullscreen
                      ? 'fixed inset-0 z-999 bg-background flex flex-col p-8 animate-in fade-in duration-200'
                      : 'border border-border/50 rounded-md overflow-hidden bg-background relative group'
                  }
                >
                  {isFullscreen && (
                    <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-4">
                      <div className="flex items-center gap-4">
                        <Label className="text-lg font-semibold">
                          {t('workflows.node_editor.transform')}
                        </Label>
                        <Select
                          value={(config.language as string) || 'json'}
                          onValueChange={(v) => handleConfigChange('language', v)}
                        >
                          <SelectTrigger className="w-[130px] h-8 text-xs">
                            <SelectValue placeholder="Language" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="json">JSON</SelectItem>
                            <SelectItem value="javascript">JavaScript</SelectItem>
                            <SelectItem value="python">Python</SelectItem>
                            <SelectItem value="yaml">YAML</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button variant="outline" onClick={() => setIsFullscreen(false)}>
                        <Minimize2 className="h-4 w-4 mr-2" /> Exit Fullscreen
                      </Button>
                    </div>
                  )}
                  {!isFullscreen && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute bottom-2 right-6 z-10 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border/50 text-muted-foreground hover:text-foreground"
                      onClick={() => setIsFullscreen(true)}
                    >
                      <Maximize2 className="h-3 w-3" />
                    </Button>
                  )}
                  <div className="flex-1 relative min-h-0 border border-border/20 rounded-sm">
                    <Editor
                      height={isFullscreen ? '100%' : '180px'}
                      language={(config.language as string) || 'json'}
                      theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                      value={(config.template as string) ?? ''}
                      onChange={(val: string | undefined) =>
                        handleConfigChange('template', val || '')
                      }
                      options={{
                        minimap: { enabled: false },
                        fontSize: 12,
                        fontFamily:
                          'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
                        formatOnPaste: true,
                        formatOnType: true,
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        lineNumbersMinChars: 3,
                        padding: { top: 12 },
                      }}
                      beforeMount={handleEditorBeforeMount}
                      loading={
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground animate-pulse py-8">
                          Loading Editor...
                        </div>
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* PROMPT config */}
            {type === 'PROMPT' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{t('workflows.node_editor.prompt')}</Label>
                  <Select onValueChange={(v) => insertVariable(`{{${v}}}`)}>
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <SelectValue placeholder="Insert Variable..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="context">context</SelectItem>
                      <SelectItem value="input">input</SelectItem>
                      <SelectItem value="agent.output">agent.output</SelectItem>
                      <SelectItem value="tool.result">tool.result</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="border border-border/50 rounded-md overflow-hidden bg-background relative min-h-0">
                  <Editor
                    height="200px"
                    language="markdown"
                    theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                    value={(config.prompt as string) ?? ''}
                    onChange={(val: string | undefined) => handleConfigChange('prompt', val || '')}
                    onMount={(editor) => {
                      editorRef.current = editor;
                    }}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 12,
                      fontFamily:
                        'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
                      formatOnPaste: true,
                      formatOnType: true,
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      lineNumbersMinChars: 3,
                      padding: { top: 12 },
                    }}
                    loading={
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground animate-pulse py-8">
                        Loading Editor...
                      </div>
                    }
                  />
                </div>
              </div>
            )}

            {/* TEXT config */}
            {type === 'TEXT' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{t('workflows.node_editor.text')}</Label>
                </div>
                <div className="border border-border/50 rounded-md overflow-hidden bg-background relative min-h-0">
                  <Editor
                    height="200px"
                    language="text"
                    theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                    value={(config.text as string) ?? ''}
                    onChange={(val: string | undefined) => handleConfigChange('text', val || '')}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 12,
                      fontFamily:
                        'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
                      formatOnPaste: true,
                      formatOnType: true,
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      lineNumbersMinChars: 3,
                      padding: { top: 12 },
                    }}
                    loading={
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground animate-pulse py-8">
                        Loading Editor...
                      </div>
                    }
                  />
                </div>
              </div>
            )}

            {/* FILE config */}
            {type === 'FILE' && (
              <FileConfigEditor config={config} handleConfigChange={handleConfigChange} />
            )}

            {/* LOOP config */}
            {type === 'LOOP' && (
              <div className="space-y-4">
                {/* Collection path */}
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Collection Path
                    <span className="ml-1 text-muted-foreground font-normal">
                      (dot-path to the array)
                    </span>
                  </Label>
                  <Input
                    placeholder="e.g. results  or  data.items  or  $.users"
                    value={(config.collection as string) ?? ''}
                    onChange={(e) => handleConfigChange('collection', e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground/70">
                    Leave empty to iterate the input directly if it is already an array.
                  </p>
                </div>

                {/* Max iterations */}
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Max Iterations{' '}
                    <span className="text-muted-foreground font-normal">(safety cap)</span>
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    value={(config.maxIterations as number) ?? 100}
                    onChange={(e) =>
                      handleConfigChange('maxIterations', parseInt(e.target.value) || 100)
                    }
                    className="h-8 text-xs w-32"
                  />
                </div>

                {/* Item Transform Script */}
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Item Script
                    <span className="ml-1 text-muted-foreground font-normal">
                      (JS — receives <code className="bg-muted px-0.5 rounded">item</code>,{' '}
                      <code className="bg-muted px-0.5 rounded">index</code>,{' '}
                      <code className="bg-muted px-0.5 rounded">data</code>,{' '}
                      <code className="bg-muted px-0.5 rounded">$</code>)
                    </span>
                  </Label>
                  <div className="border border-border/50 rounded-md overflow-hidden">
                    <Editor
                      height="160px"
                      language="javascript"
                      theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                      value={(config.itemScript as string) ?? 'return item;'}
                      onChange={(val) => handleConfigChange('itemScript', val || 'return item;')}
                      beforeMount={handleEditorBeforeMount}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 12,
                        fontFamily:
                          'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
                        scrollBeyondLastLine: false,
                        lineNumbersMinChars: 2,
                        padding: { top: 8 },
                        wordWrap: 'on',
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground/70">
                    Must <code className="bg-muted px-0.5 rounded text-[10px]">return</code> the
                    transformed item. Leave as{' '}
                    <code className="bg-muted px-0.5 rounded text-[10px]">return item;</code> to
                    pass through unchanged.
                  </p>
                </div>

                {/* Optional Filter Script */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-xs h-7 px-2 gap-2 text-muted-foreground hover:text-foreground"
                    >
                      <GitFork className="h-3.5 w-3.5" />
                      Filter Script (optional)
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1.5 pt-2">
                    <Label className="text-xs text-muted-foreground">
                      Return <code className="bg-muted px-0.5 rounded">true</code> to keep the item,{' '}
                      <code className="bg-muted px-0.5 rounded">false</code> to skip it.
                    </Label>
                    <div className="border border-border/50 rounded-md overflow-hidden">
                      <Editor
                        height="100px"
                        language="javascript"
                        theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                        value={(config.filterScript as string) ?? ''}
                        onChange={(val) => handleConfigChange('filterScript', val || '')}
                        beforeMount={handleEditorBeforeMount}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 12,
                          fontFamily:
                            'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
                          scrollBeyondLastLine: false,
                          lineNumbersMinChars: 2,
                          padding: { top: 8 },
                        }}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Output shape hint */}
                <div className="rounded-md bg-muted/30 border border-border/40 p-3 text-[11px] text-muted-foreground font-mono space-y-0.5">
                  <p className="font-semibold text-foreground/70 mb-1">
                    Output shape of this node:
                  </p>
                  <p>{'{'}</p>
                  <p className="pl-4">
                    results: any[]{' '}
                    <span className="font-sans text-muted-foreground/60">
                      {'// transformed items'}
                    </span>
                  </p>
                  <p className="pl-4">
                    count: number{' '}
                    <span className="font-sans text-muted-foreground/60">
                      {'// length of results'}
                    </span>
                  </p>
                  <p className="pl-4">
                    collection: string{' '}
                    <span className="font-sans text-muted-foreground/60">{'// the path used'}</span>
                  </p>
                  <p>{'}'}</p>
                </div>
              </div>
            )}

            {/* START / END — no extra config */}
            {(type === 'START' || type === 'END') && (
              <p className="text-sm text-muted-foreground italic">
                {t('workflows.node_editor.noConfig', {
                  label: i18n.language.startsWith('fr') ? meta.labelFr : meta.label,
                })}
              </p>
            )}

            {/* In / Out Type Declarations (for Autocomplete) */}
            <div className="pt-4 border-t border-border/50">
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between items-center text-xs h-8 px-2 font-medium bg-muted/40 hover:bg-muted/80"
                  >
                    <span className="flex items-center gap-2">
                      <Code2 className="h-4 w-4" />
                      Data Types (Interfaces)
                    </span>
                    <span className="text-muted-foreground font-normal">
                      {(config.outputType as string) ? '✓ defined' : 'click to define'}
                    </span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4 animate-in slide-in-from-top-1">
                  {/* Upstream types preview */}
                  {availableTypings &&
                    availableTypings !== 'declare const data: any;\ndeclare const $: any;\n' && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                          Available from upstream nodes
                        </Label>
                        <div className="border border-emerald-500/20 rounded-md overflow-hidden bg-emerald-950/5 relative min-h-0">
                          <Editor
                            height="100px"
                            language="typescript"
                            theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                            value={availableTypings}
                            options={{
                              minimap: { enabled: false },
                              fontSize: 10,
                              lineNumbersMinChars: 2,
                              padding: { top: 6 },
                              readOnly: true,
                              scrollBeyondLastLine: false,
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Use <code className="bg-muted px-1 rounded">data.field</code> or{' '}
                          <code className="bg-muted px-1 rounded">$.field</code> or{' '}
                          <code className="bg-muted px-1 rounded">$[&apos;field&apos;]</code> in
                          your code.
                        </p>
                      </div>
                    )}

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Input Data Interface <span className="opacity-50">(TypeScript)</span>
                    </Label>
                    <p className="text-xs text-muted-foreground/70">
                      Describes what data this node expects to receive.
                    </p>
                    <div className="border border-border/50 rounded-md overflow-hidden bg-background relative min-h-0">
                      <Editor
                        height="120px"
                        language="typescript"
                        theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                        value={(config.inputType as string) ?? ''}
                        onChange={(val: string | undefined) =>
                          handleConfigChange('inputType', val || '')
                        }
                        options={{
                          minimap: { enabled: false },
                          fontSize: 11,
                          lineNumbersMinChars: 2,
                          padding: { top: 8 },
                          scrollBeyondLastLine: false,
                          placeholder: '{ name: string; data: object }',
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Return Output Interface <span className="opacity-50">(TypeScript)</span>
                    </Label>
                    <p className="text-xs text-muted-foreground/70">
                      Describes the shape of this node&apos;s output. Next nodes can autocomplete
                      from this.
                    </p>
                    <div className="border border-border/50 rounded-md overflow-hidden bg-background relative min-h-0">
                      <Editor
                        height="120px"
                        language="typescript"
                        theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                        value={(config.outputType as string) ?? ''}
                        onChange={(val: string | undefined) =>
                          handleConfigChange('outputType', val || '')
                        }
                        options={{
                          minimap: { enabled: false },
                          fontSize: 11,
                          lineNumbersMinChars: 2,
                          padding: { top: 8 },
                          scrollBeyondLastLine: false,
                          placeholder: '{ name: string; result: Record<string, unknown> }',
                        }}
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </CardContent>

          {/* ─── Test Node Panel ─────────────────────────────────────── */}
          {isEdit && workflowId && (
            <div className="border-t border-border/50 bg-muted/10">
              <Collapsible open={testPanelOpen} onOpenChange={setTestPanelOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between text-xs h-9 px-4 font-medium rounded-none hover:bg-muted/50"
                  >
                    <span className="flex items-center gap-2">
                      <Play className="h-3.5 w-3.5 text-emerald-500" />
                      Test Node
                      {initialTestInput && !testResult && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 font-normal">
                          pre-filled from last run
                        </span>
                      )}
                    </span>
                    {testResult &&
                      (testResult.error ? (
                        <span className="flex items-center gap-1 text-destructive">
                          <AlertCircle className="h-3 w-3" /> Failed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-500">
                          <CheckCircle2 className="h-3 w-3" /> Passed
                        </span>
                      ))}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pt-3 pb-4 space-y-3 animate-in slide-in-from-top-1">
                  {/* Input Editor */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Manual Input (JSON)</Label>
                    <div className="border border-border/50 rounded-md overflow-hidden">
                      <Editor
                        height="120px"
                        language="json"
                        theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                        value={testInput}
                        onChange={(val) => setTestInput(val ?? '{}')}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 11,
                          lineNumbersMinChars: 2,
                          padding: { top: 8 },
                          scrollBeyondLastLine: false,
                          formatOnPaste: true,
                          formatOnType: true,
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
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" /> Run Node
                      </>
                    )}
                  </Button>

                  {/* Result */}
                  {testResult && (
                    <div className="space-y-2">
                      {/* Output or Error */}
                      <div
                        className={`rounded-md border p-3 text-xs font-mono overflow-auto max-h-40 ${testResult.error ? 'border-destructive/40 bg-destructive/5 text-destructive' : 'border-emerald-500/30 bg-emerald-500/5'}`}
                      >
                        <p className="font-semibold mb-1 text-muted-foreground">
                          {testResult.error ? '❌ Error' : '✅ Output'}
                        </p>
                        <pre className="whitespace-pre-wrap break-all">
                          {testResult.error
                            ? testResult.error
                            : JSON.stringify(testResult.output, null, 2)}
                        </pre>
                      </div>

                      {/* Logs */}
                      {testResult.logs.length > 0 && (
                        <div className="rounded-md border border-border/40 bg-muted/30 p-3 text-xs font-mono overflow-auto max-h-48 space-y-0.5">
                          <p className="font-semibold mb-2 text-muted-foreground tracking-wide uppercase text-[10px]">
                            Execution Logs
                          </p>
                          {testResult.logs.map((log, i) => {
                            const isConsoleError = log.startsWith('[ERROR]');
                            const isConsoleWarn = log.startsWith('[WARN]');
                            const isConsoleLine =
                              log.startsWith('[LOG]') ||
                              log.startsWith('[INFO]') ||
                              log.startsWith('[DEBUG]') ||
                              isConsoleError ||
                              isConsoleWarn;
                            return (
                              <div
                                key={i}
                                className={`flex items-start gap-1.5 py-0.5 ${
                                  isConsoleError
                                    ? 'text-red-400'
                                    : isConsoleWarn
                                      ? 'text-yellow-400'
                                      : isConsoleLine
                                        ? 'text-sky-400'
                                        : 'text-muted-foreground/70'
                                }`}
                              >
                                <span className="shrink-0 select-none">
                                  {isConsoleError
                                    ? '🔴'
                                    : isConsoleWarn
                                      ? '🟡'
                                      : isConsoleLine
                                        ? '🔵'
                                        : '·'}
                                </span>
                                <span className="break-all">{log}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          <CardFooter className="border-t border-border/50 p-4 bg-muted/20 gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              {t('workflows.node_editor.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving
                ? t('workflows.node_editor.saving')
                : isEdit
                  ? t('workflows.node_editor.updateNode')
                  : t('workflows.node_editor.addNode')}
            </Button>
          </CardFooter>
        </Card>
      </Resizable>
    </div>,
    document.body,
  );
}

/** Public export — passes a key so the form resets when initialNode changes */
export function NodeEditor(props: NodeEditorProps) {
  return (
    <NodeEditorForm
      key={`${props.initialNode?.id ?? 'new'}-${props.open ? 'open' : 'closed'}`}
      {...props}
      agents={props.agents ?? []}
      tools={props.tools ?? []}
      availableTypings={props.availableTypings ?? ''}
    />
  );
}
