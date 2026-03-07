'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Bot,
  Wrench,
  Plus,
  Layers,
  GripVertical,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { useWorkspaceStore, type FileNode } from '@/features/workspace/store/workspaceStore';

/** Sub-agent configuration inside an AGENT node */
export interface SubAgentConfig {
  agentId: string;
  role?: string;
  /** If true, the parent agent will summarize context before handing off to save tokens */
  compactHandoff?: boolean;
}

// ─── Schema field types ───────────────────────────────────────────────────────
const FIELD_TYPES = ['string', 'number', 'boolean', 'object', 'array', 'any'] as const;
type FieldType = (typeof FIELD_TYPES)[number];

export interface SchemaField {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  description?: string;
}

// ─── Pipeline step types ──────────────────────────────────────────────────────
export type PipelineStepType = 'TOOL' | 'TRANSFORM';

export interface PipelineStep {
  id: string;
  type: PipelineStepType;
  label: string;
  /** TOOL: toolId; TRANSFORM: script */
  config: Record<string, unknown>;
}

// ─── SchemaFieldEditor ────────────────────────────────────────────────────────
function SchemaFieldEditor({
  fields,
  onChange,
  label,
  accent = 'blue',
}: {
  fields: SchemaField[];
  onChange: (fields: SchemaField[]) => void;
  label: string;
  accent?: 'blue' | 'green';
}) {
  const colors = {
    blue: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
    green: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  };
  const typeColors: Record<FieldType, string> = {
    string: 'text-amber-400',
    number: 'text-blue-400',
    boolean: 'text-purple-400',
    object: 'text-emerald-400',
    array: 'text-pink-400',
    any: 'text-muted-foreground',
  };

  const addField = () =>
    onChange([
      ...fields,
      { id: uuidv4(), name: '', type: 'string', required: true, description: '' },
    ]);

  const removeField = (id: string) => onChange(fields.filter((f) => f.id !== id));

  const updateField = (id: string, patch: Partial<SchemaField>) =>
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  return (
    <div className="space-y-2">
      <div className={`rounded-md border px-2 pt-1.5 pb-2 ${colors[accent]}`}>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 opacity-70">
          {label}
        </p>
        {fields.length === 0 && (
          <p className="text-[11px] text-muted-foreground italic py-1">No fields defined.</p>
        )}
        <div className="space-y-1.5">
          {fields.map((f) => (
            <div
              key={f.id}
              className="flex items-start gap-1.5 bg-background/60 rounded-md px-2 py-1.5 border border-border/30"
            >
              <GripVertical className="h-3.5 w-3.5 mt-1.5 text-muted-foreground/40 shrink-0" />
              <div className="flex-1 grid grid-cols-2 gap-1.5">
                {/* Name */}
                <Input
                  className="h-6 text-[11px] font-mono col-span-1"
                  placeholder="fieldName"
                  value={f.name}
                  onChange={(e) => updateField(f.id, { name: e.target.value })}
                />
                {/* Type */}
                <Select
                  value={f.type}
                  onValueChange={(v) => updateField(f.id, { type: v as FieldType })}
                >
                  <SelectTrigger className="h-6 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        <span className={typeColors[t]}>{t}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Description — full width */}
                <Input
                  className="h-6 text-[11px] col-span-2 text-muted-foreground"
                  placeholder="description (optional)"
                  value={f.description ?? ''}
                  onChange={(e) => updateField(f.id, { description: e.target.value })}
                />
              </div>
              {/* Required toggle */}
              <div className="flex flex-col items-center gap-0.5 pt-1">
                <button
                  title={f.required ? 'Required' : 'Optional'}
                  onClick={() => updateField(f.id, { required: !f.required })}
                  className={`text-[9px] font-bold rounded px-1 py-0.5 leading-none border ${
                    f.required
                      ? 'bg-primary/20 text-primary border-primary/30'
                      : 'bg-muted/40 text-muted-foreground border-border/30'
                  }`}
                >
                  {f.required ? 'req' : 'opt'}
                </button>
              </div>
              {/* Remove */}
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-destructive/50 hover:text-destructive shrink-0"
                onClick={() => removeField(f.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px] gap-1 mt-1 w-full opacity-60 hover:opacity-100"
          onClick={addField}
        >
          <Plus className="h-3 w-3" /> Add field
        </Button>
      </div>
    </div>
  );
}

// Helper: generate TypeScript interface from schema fields
function schemaToTypeScript(fields: SchemaField[]): string {
  if (fields.length === 0) return '';
  const lines = fields.map((f) => {
    const optional = f.required ? '' : '?';
    const comment = f.description ? `  // ${f.description}` : '';
    return `  ${f.name}${optional}: ${f.type};${comment}`;
  });
  return `{
${lines.join('\n')}
}`;
}

// ─── PipelineStepEditor ───────────────────────────────────────────────────────
function PipelineStepEditor({
  steps,
  tools,
  onChange,
  theme,
}: {
  steps: PipelineStep[];
  tools: { id: string; name: string }[];
  onChange: (steps: PipelineStep[]) => void;
  theme: string;
}) {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const addStep = (type: PipelineStepType) =>
    onChange([
      ...steps,
      {
        id: uuidv4(),
        type,
        label: type === 'TOOL' ? 'Tool Step' : 'Transform Step',
        config: type === 'TOOL' ? { toolId: '' } : { script: 'return { ...data };' },
      },
    ]);

  const removeStep = (id: string) => onChange(steps.filter((s) => s.id !== id));

  const updateStep = (id: string, patch: Partial<PipelineStep>) =>
    onChange(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const updateStepConfig = (id: string, key: string, value: unknown) =>
    onChange(steps.map((s) => (s.id === id ? { ...s, config: { ...s.config, [key]: value } } : s)));

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-2">
      {steps.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic">No pipeline steps yet.</p>
      )}
      {steps.map((step, idx) => (
        <div
          key={step.id}
          className="rounded-md border border-border/50 bg-muted/10 overflow-hidden"
        >
          {/* Step header */}
          <div
            className="flex items-center gap-2 px-2 py-1.5 cursor-pointer select-none hover:bg-muted/20"
            onClick={() => toggle(step.id)}
          >
            <span className="text-[10px] font-mono text-muted-foreground/50 w-4">{idx + 1}.</span>
            <Badge
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 ${
                step.type === 'TOOL' ? 'text-amber-500' : 'text-violet-500'
              }`}
            >
              {step.type}
            </Badge>
            <Input
              className="h-6 text-[11px] flex-1 border-0 bg-transparent shadow-none px-0 focus-visible:ring-0"
              placeholder="Step label…"
              value={step.label}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => updateStep(step.id, { label: e.target.value })}
            />
            {expanded[step.id] ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 text-destructive/50 hover:text-destructive shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                removeStep(step.id);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          {/* Step config body */}
          {expanded[step.id] && (
            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/30">
              {step.type === 'TOOL' ? (
                <div className="space-y-1">
                  <Label className="text-[10px]">Tool</Label>
                  {tools.length > 0 ? (
                    <Select
                      value={(step.config.toolId as string) ?? ''}
                      onValueChange={(v) => updateStepConfig(step.id, 'toolId', v)}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Select tool…" />
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
                      className="h-7 text-xs font-mono"
                      placeholder="tool-id"
                      value={(step.config.toolId as string) ?? ''}
                      onChange={(e) => updateStepConfig(step.id, 'toolId', e.target.value)}
                    />
                  )}
                  <p className="text-[10px] text-muted-foreground">Input: previous step output</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-[10px]">
                    Transform Script{' '}
                    <span className="text-muted-foreground font-normal">
                      — use <code className="bg-muted px-1 rounded">data</code> /{' '}
                      <code className="bg-muted px-1 rounded">$</code>, return new object
                    </span>
                  </Label>
                  <div className="border border-border/50 rounded overflow-hidden">
                    <Editor
                      height="100px"
                      language="javascript"
                      theme={theme === 'dark' ? 'vs-dark' : 'light'}
                      value={(step.config.script as string) ?? 'return { ...data };'}
                      onChange={(v) => updateStepConfig(step.id, 'script', v ?? '')}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 11,
                        lineNumbersMinChars: 2,
                        padding: { top: 6 },
                        scrollBeyondLastLine: false,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px] gap-1.5 flex-1"
          onClick={() => addStep('TOOL')}
        >
          <Wrench className="h-3 w-3 text-amber-500" /> + Tool Step
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px] gap-1.5 flex-1"
          onClick={() => addStep('TRANSFORM')}
        >
          <Layers className="h-3 w-3 text-violet-500" /> + Transform Step
        </Button>
      </div>
    </div>
  );
}

// ─── WorkspaceReadConfig ─────────────────────────────────────────────────────
function WorkspaceReadConfig({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
}) {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const selectedId = (config.workspaceId as string) ?? workspaces[0]?.id ?? '';
  const selectedWs = workspaces.find((w) => w.id === selectedId);

  // Build flat file list for the datalist
  const allFilePaths: string[] = [];
  const collectPaths = (nodes: FileNode[] | undefined) => {
    if (!nodes) return;
    for (const node of nodes) {
      if (node.kind === 'file') allFilePaths.push(node.path.replace(/^\/[^/]+\//, ''));
      if (node.children) collectPaths(node.children);
    }
  };
  if (selectedWs?.fileTree?.children) collectPaths(selectedWs.fileTree.children);

  return (
    <div className="space-y-4">
      {workspaces.length === 0 ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-600 dark:text-amber-400">
          ⚠️ No workspace open. Open a folder from the <strong>header menu</strong> or{' '}
          <strong>Workspace</strong> tab first.
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-xs">
            Workspace{' '}
            <span className="text-muted-foreground font-normal">(folder to read from)</span>
          </Label>
          <Select value={selectedId} onValueChange={(v) => onConfigChange('workspaceId', v)}>
            <SelectTrigger className="h-9 text-sm font-mono">
              <SelectValue placeholder="Select workspace…" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((ws) => (
                <SelectItem key={ws.id} value={ws.id} className="font-mono text-sm">
                  📁 {ws.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">
          File Path{' '}
          <span className="text-muted-foreground font-normal">(relative to workspace root)</span>
        </Label>
        <input
          list="ws-read-files"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm font-mono shadow-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          placeholder="src/index.ts"
          value={(config.filePath as string) ?? ''}
          onChange={(e) => onConfigChange('filePath', e.target.value)}
        />
        <datalist id="ws-read-files">
          {allFilePaths.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <p className="text-[10px] text-muted-foreground">
          Output:{' '}
          <code className="bg-muted px-1 rounded">
            {'{ content: string, path: string, workspaceName: string }'}
          </code>
        </p>
      </div>
    </div>
  );
}

// ─── WorkspaceWriteConfig ─────────────────────────────────────────────────────
function WorkspaceWriteConfig({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
}) {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const selectedId = (config.workspaceId as string) ?? workspaces[0]?.id ?? '';

  return (
    <div className="space-y-4">
      {workspaces.length === 0 ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-600 dark:text-amber-400">
          ⚠️ No workspace open. Open a folder from the <strong>header menu</strong> or{' '}
          <strong>Workspace</strong> tab first.
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-xs">
            Workspace{' '}
            <span className="text-muted-foreground font-normal">(folder to write into)</span>
          </Label>
          <Select value={selectedId} onValueChange={(v) => onConfigChange('workspaceId', v)}>
            <SelectTrigger className="h-9 text-sm font-mono">
              <SelectValue placeholder="Select workspace…" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((ws) => (
                <SelectItem key={ws.id} value={ws.id} className="font-mono text-sm">
                  📁 {ws.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">
            Only authorised (open) workspaces can be written to.
          </p>
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs">
          Destination Path{' '}
          <span className="text-muted-foreground font-normal">(relative to workspace root)</span>
        </Label>
        <input
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm font-mono shadow-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          placeholder="output/result.txt"
          value={(config.filePath as string) ?? ''}
          onChange={(e) => onConfigChange('filePath', e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">
          Content{' '}
          <span className="text-muted-foreground font-normal">
            — use <code className="bg-muted px-1 rounded">{'{{variable}}'}</code> or leave empty to
            use previous node output
          </span>
        </Label>
        <Textarea
          rows={4}
          className="font-mono text-xs"
          placeholder={'{{output}}\n\nor leave empty to pipe previous node result'}
          value={(config.content as string) ?? ''}
          onChange={(e) => onConfigChange('content', e.target.value)}
        />
        <p className="text-[10px] text-muted-foreground">
          Output:{' '}
          <code className="bg-muted px-1 rounded">{'{ written: boolean, path: string }'}</code>
        </p>
      </div>
    </div>
  );
}

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
  /** Existing agents — includes their native tool IDs so we can show them as a preview */
  agents?: { id: string; name: string; tools?: string[] }[];
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
            {type === 'AGENT' &&
              (() => {
                /** Resolve the currently selected agent object */
                const selectedAgent = agents.find((a) => a.id === (config.agentId as string));
                /** Tool IDs that the agent natively carries */
                const agentToolIds: string[] = selectedAgent?.tools ?? [];
                /** Resolve names for display */
                const agentToolNames = agentToolIds.map(
                  (tid) => tools.find((t) => t.id === tid)?.name ?? tid,
                );
                return (
                  <div className="space-y-4">
                    {/* Primary agent selector */}
                    <div className="space-y-1.5">
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

                    {/* Agent's inherited tools — read-only preview */}
                    {selectedAgent && (
                      <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5 space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/80 flex items-center gap-1.5">
                          <Wrench className="h-3 w-3" />
                          Agent&apos;s native tools
                          <span className="font-normal normal-case text-muted-foreground">
                            — inherited automatically
                          </span>
                        </p>
                        {agentToolNames.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground italic">
                            No tools assigned to this agent.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {agentToolNames.map((name, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-medium"
                              >
                                <Wrench className="h-2.5 w-2.5" />
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Extra Tools — node-level overrides */}
                    <div className="space-y-2">
                      <Label className="text-xs flex items-center gap-1.5">
                        <Wrench className="h-3.5 w-3.5 text-amber-500" />
                        Extra Tools
                        <span className="text-muted-foreground font-normal">
                          {"overrides agent's tool list in this node"}
                        </span>
                      </Label>
                      <div className="space-y-1.5">
                        {((config.toolIds as string[]) ?? []).map((tid, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            {tools.length > 0 ? (
                              <Select
                                value={tid}
                                onValueChange={(v) => {
                                  const next = [...((config.toolIds as string[]) ?? [])];
                                  next[idx] = v;
                                  handleConfigChange('toolIds', next);
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs flex-1">
                                  <SelectValue placeholder="Select tool…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {tools.map((tl) => (
                                    <SelectItem key={tl.id} value={tl.id}>
                                      {tl.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                className="h-8 text-xs flex-1 font-mono"
                                placeholder="tool-id"
                                value={tid}
                                onChange={(e) => {
                                  const next = [...((config.toolIds as string[]) ?? [])];
                                  next[idx] = e.target.value;
                                  handleConfigChange('toolIds', next);
                                }}
                              />
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive shrink-0"
                              onClick={() => {
                                const next = ((config.toolIds as string[]) ?? []).filter(
                                  (_, i) => i !== idx,
                                );
                                handleConfigChange('toolIds', next);
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5 w-full"
                          onClick={() =>
                            handleConfigChange('toolIds', [
                              ...((config.toolIds as string[]) ?? []),
                              '',
                            ])
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Tool
                        </Button>
                      </div>
                    </div>

                    {/* Sub-agents */}
                    <div className="space-y-2">
                      <Label className="text-xs flex items-center gap-1.5">
                        <Bot className="h-3.5 w-3.5 text-violet-500" />
                        Sub-Agents
                        <span className="text-muted-foreground font-normal">
                          (called by this agent during execution)
                        </span>
                      </Label>
                      <div className="space-y-2">
                        {((config.subAgents as SubAgentConfig[]) ?? []).map((sa, idx) => (
                          <div
                            key={idx}
                            className="rounded-md border border-border/50 p-2 space-y-1.5 bg-muted/20"
                          >
                            <div className="flex items-center gap-2">
                              {agents.length > 0 ? (
                                <Select
                                  value={sa.agentId}
                                  onValueChange={(v) => {
                                    const next = [
                                      ...((config.subAgents as SubAgentConfig[]) ?? []),
                                    ];
                                    next[idx] = { ...sa, agentId: v };
                                    handleConfigChange('subAgents', next);
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs flex-1">
                                    <SelectValue placeholder="Select sub-agent…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {agents
                                      .filter((a) => a.id !== (config.agentId as string))
                                      .map((a) => (
                                        <SelectItem key={a.id} value={a.id}>
                                          {a.name}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  className="h-8 text-xs flex-1 font-mono"
                                  placeholder="agent-id"
                                  value={sa.agentId}
                                  onChange={(e) => {
                                    const next = [
                                      ...((config.subAgents as SubAgentConfig[]) ?? []),
                                    ];
                                    next[idx] = { ...sa, agentId: e.target.value };
                                    handleConfigChange('subAgents', next);
                                  }}
                                />
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive shrink-0"
                                onClick={() => {
                                  const next = (
                                    (config.subAgents as SubAgentConfig[]) ?? []
                                  ).filter((_, i) => i !== idx);
                                  handleConfigChange('subAgents', next);
                                }}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            {/* Role / task hint */}
                            <Input
                              className="h-7 text-xs"
                              placeholder="Role / task description (helps with handoff)"
                              value={sa.role ?? ''}
                              onChange={(e) => {
                                const next = [...((config.subAgents as SubAgentConfig[]) ?? [])];
                                next[idx] = { ...sa, role: e.target.value };
                                handleConfigChange('subAgents', next);
                              }}
                            />
                            {/* Compact handoff toggle */}
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <input
                                type="checkbox"
                                id={`compact-${idx}`}
                                checked={sa.compactHandoff ?? true}
                                onChange={(e) => {
                                  const next = [...((config.subAgents as SubAgentConfig[]) ?? [])];
                                  next[idx] = { ...sa, compactHandoff: e.target.checked };
                                  handleConfigChange('subAgents', next);
                                }}
                                className="accent-primary"
                              />
                              <label htmlFor={`compact-${idx}`}>
                                Compact handoff — summarize context before passing to sub-agent
                                (saves tokens)
                              </label>
                            </div>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5 w-full"
                          onClick={() =>
                            handleConfigChange('subAgents', [
                              ...((config.subAgents as SubAgentConfig[]) ?? []),
                              { agentId: '', role: '', compactHandoff: true },
                            ])
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Sub-Agent
                        </Button>
                      </div>
                    </div>

                    {/* Sub-agents preview rows (resolved names) */}
                    {((config.subAgents as { agentId: string; role?: string }[]) ?? []).length >
                      0 && (
                      <div className="rounded-md border border-violet-500/20 bg-violet-500/5 p-2.5 space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-500/80 flex items-center gap-1.5">
                          <Bot className="h-3 w-3" />
                          Sub-agents configured
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {((config.subAgents as { agentId: string; role?: string }[]) ?? []).map(
                            (sa, i) => {
                              const name =
                                agents.find((a) => a.id === sa.agentId)?.name ?? sa.agentId;
                              return (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 font-medium"
                                  title={sa.role ?? ''}
                                >
                                  <Bot className="h-2.5 w-2.5" />
                                  {name}
                                </span>
                              );
                            },
                          )}
                        </div>
                      </div>
                    )}

                    {/* Token budget override */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Max Tokens{' '}
                        <span className="text-muted-foreground font-normal">
                          (0 = use agent default)
                        </span>
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 text-xs w-36"
                        value={(config.maxTokens as number) ?? 0}
                        onChange={(e) =>
                          handleConfigChange('maxTokens', parseInt(e.target.value) || 0)
                        }
                      />
                    </div>

                    {/* Output shape hint */}
                    <div className="rounded-md bg-muted/30 border border-border/40 p-3 text-[11px] text-muted-foreground font-mono space-y-0.5">
                      <p className="font-semibold text-foreground/70 mb-1">Output shape:</p>
                      <p>{'{'}</p>
                      <p className="pl-4">
                        output: string <span className="font-sans">{'// agent final answer'}</span>
                      </p>
                      <p className="pl-4">
                        tokens: number <span className="font-sans">{'// total tokens used'}</span>
                      </p>
                      <p className="pl-4">
                        toolCalls?: any[] <span className="font-sans">{'// tool invocations'}</span>
                      </p>
                      <p className="pl-4">
                        subAgentResults?: any[]{' '}
                        <span className="font-sans">{'// sub-agent outputs'}</span>
                      </p>
                      <p>{'}'}</p>
                    </div>

                    {/* Pipeline Steps */}
                    <div className="pt-2 border-t border-border/40">
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-between items-center text-xs h-8 px-2 font-medium bg-muted/30 hover:bg-muted/70"
                          >
                            <span className="flex items-center gap-2">
                              <Layers className="h-3.5 w-3.5 text-violet-500" />
                              Post-Processing Pipeline
                            </span>
                            <span className="text-muted-foreground font-normal">
                              {((config.pipelineSteps as PipelineStep[]) ?? []).length} step(s)
                            </span>
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3 animate-in slide-in-from-top-1">
                          <p className="text-[10px] text-muted-foreground mb-2">
                            Steps run sequentially after the agent responds. Each step receives the
                            previous step’s output as{' '}
                            <code className="bg-muted px-1 rounded">data</code>.
                          </p>
                          <PipelineStepEditor
                            steps={(config.pipelineSteps as PipelineStep[]) ?? []}
                            tools={tools}
                            theme={resolvedTheme ?? 'dark'}
                            onChange={(steps) => handleConfigChange('pipelineSteps', steps)}
                          />
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </div>
                );
              })()}

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
            {/* GITHUB config */}
            {type === 'GITHUB' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">GitHub Token</Label>
                  <Input
                    type="password"
                    placeholder="ghp_xxx..."
                    value={(config.token as string) ?? ''}
                    onChange={(e) => handleConfigChange('token', e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="w-1/3 space-y-1.5">
                    <Label className="text-xs">Method</Label>
                    <Select
                      value={(config.method as string) ?? 'GET'}
                      onValueChange={(v) => handleConfigChange('method', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PATCH">PATCH</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs">Endpoint</Label>
                    <Input
                      placeholder="/user or /repos/owner/repo"
                      value={(config.endpoint as string) ?? ''}
                      onChange={(e) => handleConfigChange('endpoint', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Request Body (JSON)</Label>
                  <Textarea
                    placeholder='{"key": "value"}'
                    rows={3}
                    className="font-mono text-xs"
                    value={(config.body as string) ?? ''}
                    onChange={(e) => handleConfigChange('body', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* SLACK config */}
            {type === 'SLACK' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Bot Token</Label>
                  <Input
                    type="password"
                    placeholder="xoxb-xxx..."
                    value={(config.token as string) ?? ''}
                    onChange={(e) => handleConfigChange('token', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Channel</Label>
                  <Input
                    placeholder="#general or C12345678"
                    value={(config.channel as string) ?? ''}
                    onChange={(e) => handleConfigChange('channel', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Message</Label>
                  <Textarea
                    placeholder="Hello from workflow..."
                    rows={4}
                    value={(config.message as string) ?? ''}
                    onChange={(e) => handleConfigChange('message', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* WHATSAPP config */}
            {type === 'WHATSAPP' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Graph API Token</Label>
                  <Input
                    type="password"
                    placeholder="EAA..."
                    value={(config.token as string) ?? ''}
                    onChange={(e) => handleConfigChange('token', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone Number ID</Label>
                  <Input
                    placeholder="123456789"
                    value={(config.phoneNumberId as string) ?? ''}
                    onChange={(e) => handleConfigChange('phoneNumberId', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">To (Recipient)</Label>
                  <Input
                    placeholder="1234567890"
                    value={(config.to as string) ?? ''}
                    onChange={(e) => handleConfigChange('to', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Message</Label>
                  <Textarea
                    placeholder="Hello WhatsApp..."
                    rows={3}
                    value={(config.message as string) ?? ''}
                    onChange={(e) => handleConfigChange('message', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* SHELL config */}
            {type === 'SHELL' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Command</Label>
                  <div className="border border-border/50 rounded-md overflow-hidden min-h-0 bg-background">
                    <Editor
                      height="120px"
                      language="shell"
                      theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                      value={(config.command as string) ?? ''}
                      onChange={(val) => handleConfigChange('command', val || '')}
                      options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Timeout (ms)</Label>
                  <Input
                    type="number"
                    value={(config.timeout as number) ?? 30000}
                    onChange={(e) =>
                      handleConfigChange('timeout', parseInt(e.target.value) || 30000)
                    }
                  />
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

            {/* WORKSPACE_READ config */}
            {type === 'WORKSPACE_READ' && (
              <WorkspaceReadConfig config={config} onConfigChange={handleConfigChange} />
            )}

            {/* WORKSPACE_WRITE config */}
            {type === 'WORKSPACE_WRITE' && (
              <WorkspaceWriteConfig config={config} onConfigChange={handleConfigChange} />
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

                  <div className="space-y-3">
                    <p className="text-[10px] text-muted-foreground">
                      Define fields visually — the TypeScript interface below is generated
                      automatically.
                    </p>
                    <SchemaFieldEditor
                      label="Input fields"
                      accent="blue"
                      fields={(config.inputFields as SchemaField[]) ?? []}
                      onChange={(fields) => {
                        handleConfigChange('inputFields', fields);
                        const ts = schemaToTypeScript(fields);
                        if (ts) handleConfigChange('inputType', ts);
                      }}
                    />
                    <Label className="text-xs text-muted-foreground">
                      Input Data Interface{' '}
                      <span className="opacity-50">
                        (TypeScript — edit directly or use fields above)
                      </span>
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

                  <div className="space-y-3">
                    <SchemaFieldEditor
                      label="Output fields"
                      accent="green"
                      fields={(config.outputFields as SchemaField[]) ?? []}
                      onChange={(fields) => {
                        handleConfigChange('outputFields', fields);
                        const ts = schemaToTypeScript(fields);
                        if (ts) handleConfigChange('outputType', ts);
                      }}
                    />
                    <Label className="text-xs text-muted-foreground">
                      Return Output Interface{' '}
                      <span className="opacity-50">
                        (TypeScript — edit directly or use fields above)
                      </span>
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
