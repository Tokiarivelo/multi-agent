'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateTool } from '../hooks/useTools';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  ChevronLeft,
  Plus,
  Trash2,
  Code2,
  Cpu,
  Globe,
  Database,
  FileCode2,
  Wifi,
  Box,
  Save,
  Wrench,
  GripVertical,
  ExternalLink,
  KeyRound,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import * as LucideIcons from 'lucide-react';
import { McpConfig } from '@/types';

const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

// ─── Tool type definitions ─────────────────────────────────────────────────────

type ToolType = 'CUSTOM' | 'MCP';

const TOOL_TYPES: { id: ToolType; label: string; description: string; icon: React.ReactNode; accent: string }[] = [
  {
    id: 'CUSTOM',
    label: 'Custom Code',
    description: 'JavaScript executed in a secure sandbox',
    icon: <Code2 className="h-5 w-5" />,
    accent: 'border-violet-500/60 bg-violet-500/5 text-violet-600 dark:text-violet-400',
  },
  {
    id: 'MCP',
    label: 'MCP Tool',
    description: 'Delegate to a Model Context Protocol server',
    icon: <Cpu className="h-5 w-5" />,
    accent: 'border-sky-500/60 bg-sky-500/5 text-sky-600 dark:text-sky-400',
  },
];

const CATEGORIES = [
  { value: 'CUSTOM', label: 'Custom', icon: Box },
  { value: 'API', label: 'API Integration', icon: Globe },
  { value: 'DATABASE', label: 'Database', icon: Database },
  { value: 'FILE', label: 'File System', icon: FileCode2 },
  { value: 'WEB', label: 'Web / Browser', icon: Wifi },
  { value: 'MCP', label: 'MCP', icon: Cpu },
] as const;

const PARAM_TYPES = ['string', 'number', 'boolean', 'object', 'array'] as const;

// ─── Icon preview ─────────────────────────────────────────────────────────────

function IconPreview({ name }: { name: string }) {
  if (!name) return <Wrench className="h-5 w-5 text-muted-foreground" />;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = (LucideIcons as any)[name] ?? (LucideIcons as any)[name.charAt(0).toUpperCase() + name.slice(1)];
  if (!Icon) return <Wrench className="h-5 w-5 text-muted-foreground" />;
  return <Icon className="h-5 w-5" />;
}

// ─── Parameter row ────────────────────────────────────────────────────────────

function ParameterRow({
  param,
  index,
  onChange,
  onRemove,
}: {
  param: { name: string; type: string; description: string; required: boolean };
  index: number;
  onChange: (field: string, value: string | boolean) => void;
  onRemove: () => void;
}) {
  return (
    <div className="group flex gap-2 items-start rounded-lg border border-border/50 bg-muted/20 p-3 hover:border-border transition-colors">
      <GripVertical className="h-4 w-4 mt-2 text-muted-foreground/40 shrink-0" />
      <div className="flex-1 grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Name</Label>
          <Input
            value={param.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="param_name"
            className="h-8 text-xs font-mono"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Type</Label>
          <Select value={param.type} onValueChange={(v) => onChange('type', v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARAM_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Description</Label>
          <Input
            value={param.description}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder="What does this parameter do?"
            className="h-8 text-xs"
          />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange('required', !param.required)}
            className={cn(
              'flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border transition-colors',
              param.required
                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                : 'border-border bg-background text-muted-foreground hover:border-border/80',
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', param.required ? 'bg-destructive' : 'bg-muted-foreground/40')} />
            {param.required ? 'Required' : 'Optional'}
          </button>
          <span className="text-xs text-muted-foreground">·  param #{index + 1}</span>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ─── MCP config section ───────────────────────────────────────────────────────

function McpConfigSection({
  config,
  onChange,
}: {
  config: McpConfig;
  onChange: (c: McpConfig) => void;
}) {
  const [headerKey, setHeaderKey] = useState('');
  const [headerVal, setHeaderVal] = useState('');

  const addHeader = () => {
    if (!headerKey.trim()) return;
    onChange({ ...config, headers: { ...(config.headers ?? {}), [headerKey.trim()]: headerVal } });
    setHeaderKey('');
    setHeaderVal('');
  };

  const removeHeader = (key: string) => {
    const headers = { ...(config.headers ?? {}) };
    delete headers[key];
    onChange({ ...config, headers });
  };

  return (
    <div className="space-y-4">
      {/* Server URL */}
      <div className="space-y-1.5">
        <Label className="text-sm">MCP Server URL</Label>
        <p className="text-xs text-muted-foreground">
          The endpoint that accepts JSON-RPC 2.0 <code className="text-xs bg-muted px-1 rounded">tools/call</code> requests.
        </p>
        <div className="relative">
          <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={config.serverUrl}
            onChange={(e) => onChange({ ...config, serverUrl: e.target.value })}
            placeholder="https://mcp.example.com/rpc"
            className="pl-9 font-mono text-sm"
          />
        </div>
      </div>

      {/* Tool name on MCP server */}
      <div className="space-y-1.5">
        <Label className="text-sm">Tool Name on Server</Label>
        <p className="text-xs text-muted-foreground">
          The exact name of the tool as registered on the MCP server.
        </p>
        <Input
          value={config.toolName}
          onChange={(e) => onChange({ ...config, toolName: e.target.value })}
          placeholder="search_web"
          className="font-mono text-sm"
        />
      </div>

      {/* Transport */}
      <div className="space-y-1.5">
        <Label className="text-sm">Transport</Label>
        <div className="flex gap-2">
          {(['http', 'sse'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ ...config, transport: t })}
              className={cn(
                'flex-1 py-2 rounded-lg border text-sm font-medium transition-colors',
                config.transport === t
                  ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400'
                  : 'border-border bg-background text-muted-foreground hover:border-border/80',
              )}
            >
              {t.toUpperCase()}
              {t === 'http' && <span className="block text-[10px] font-normal opacity-70">request/response</span>}
              {t === 'sse' && <span className="block text-[10px] font-normal opacity-70">streaming</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Auth headers */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="text-sm">Headers</Label>
          <Badge variant="outline" className="text-[10px] h-4">optional</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Add Authorization headers or any custom headers required by the server.</p>

        {Object.entries(config.headers ?? {}).length > 0 && (
          <div className="space-y-1.5">
            {Object.entries(config.headers!).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-1.5 text-xs font-mono">
                <span className="text-primary/80 shrink-0">{k}:</span>
                <span className="text-muted-foreground truncate flex-1">{v}</span>
                <button type="button" onClick={() => removeHeader(k)} className="text-muted-foreground hover:text-destructive ml-auto shrink-0">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={headerKey}
            onChange={(e) => setHeaderKey(e.target.value)}
            placeholder="Authorization"
            className="h-8 text-xs font-mono"
          />
          <Input
            value={headerVal}
            onChange={(e) => setHeaderVal(e.target.value)}
            placeholder="Bearer token…"
            className="h-8 text-xs font-mono flex-1"
            onKeyDown={(e) => e.key === 'Enter' && addHeader()}
          />
          <Button type="button" variant="outline" size="sm" onClick={addHeader} className="h-8 shrink-0">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main form ─────────────────────────────────────────────────────────────────

export function CreateToolForm() {
  const router = useRouter();
  const createTool = useCreateTool();

  const [toolType, setToolType] = useState<ToolType>('CUSTOM');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('CUSTOM');
  const [icon, setIcon] = useState('');
  const [code, setCode] = useState(
    '// Access input via `parameters` or `params`\n// Must return a value\nreturn parameters;\n',
  );
  const [mcpConfig, setMcpConfig] = useState<McpConfig>({
    serverUrl: '',
    toolName: '',
    transport: 'http',
    headers: {},
  });
  const [parameters, setParameters] = useState<
    Array<{ name: string; type: string; description: string; required: boolean }>
  >([]);

  const handleSave = () => {
    createTool.mutate(
      {
        name,
        description,
        category: toolType === 'MCP' ? 'MCP' : category,
        icon: icon || undefined,
        code: toolType === 'CUSTOM' ? code : undefined,
        mcpConfig: toolType === 'MCP' ? mcpConfig : undefined,
        parameters,
      },
      { onSuccess: () => router.push('/tools') },
    );
  };

  const addParameter = () =>
    setParameters((p) => [...p, { name: '', type: 'string', description: '', required: false }]);

  const updateParameter = (i: number, field: string, value: string | boolean) =>
    setParameters((p) => p.map((param, idx) => (idx === i ? { ...param, [field]: value } : param)));

  const removeParameter = (i: number) =>
    setParameters((p) => p.filter((_, idx) => idx !== i));

  const isSaving = createTool.isPending;
  const canSave = name.trim() && description.trim() && (toolType !== 'MCP' || (mcpConfig.serverUrl && mcpConfig.toolName));

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/tools">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold">New Tool</h1>
            <p className="text-xs text-muted-foreground">Create a custom or MCP-backed tool for your agents</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving || !canSave} className="gap-2">
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving…' : 'Save Tool'}
        </Button>
      </div>

      {/* Tool type selector */}
      <div>
        <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Tool Type</Label>
        <div className="grid grid-cols-2 gap-3">
          {TOOL_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setToolType(t.id);
                if (t.id === 'MCP') setCategory('MCP');
              }}
              className={cn(
                'flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all',
                toolType === t.id
                  ? t.accent
                  : 'border-border bg-background hover:bg-muted/30',
              )}
            >
              <div className={cn('mt-0.5 rounded-lg p-1.5', toolType === t.id ? 'bg-current/10' : 'bg-muted')}>
                {t.icon}
              </div>
              <div>
                <p className="font-medium text-sm">{t.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Basic info */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground/80">Basic Information</h2>

        <div className="grid grid-cols-2 gap-4">
          {/* Name */}
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="name">Tool Name <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my_tool_name"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">snake_case, unique across all tools</p>
          </div>

          {/* Description */}
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this tool does and when agents should use it…"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">This is what the agent reads to decide whether to call the tool.</p>
          </div>

          {/* Category — hidden for MCP (auto-set) */}
          {toolType !== 'MCP' && (
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter((c) => c.value !== 'MCP').map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">
                        <c.icon className="h-3.5 w-3.5" />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Icon */}
          <div className="space-y-1.5">
            <Label htmlFor="icon">Icon <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <div className="flex gap-2 items-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-muted/50 shrink-0">
                <IconPreview name={icon} />
              </div>
              <Input
                id="icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="Wrench"
                className="font-mono text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">Any Lucide icon name (PascalCase or camelCase)</p>
          </div>
        </div>
      </div>

      {/* Implementation */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground/80">
          {toolType === 'CUSTOM' ? 'Execution Script' : 'MCP Server Configuration'}
        </h2>

        {toolType === 'CUSTOM' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                JavaScript/Node.js sandbox — access inputs via{' '}
                <code className="bg-muted px-1 rounded text-[11px]">parameters</code> or{' '}
                <code className="bg-muted px-1 rounded text-[11px]">params</code>. Must return a value.
              </p>
              <Badge variant="secondary" className="text-[10px]">isolated-vm</Badge>
            </div>
            <div className="rounded-lg overflow-hidden border border-border/50">
              <Editor
                height="220px"
                language="javascript"
                theme="vs-dark"
                value={code}
                onChange={(v) => setCode(v ?? '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  padding: { top: 12, bottom: 12 },
                  fontFamily: 'JetBrains Mono, Fira Code, monospace',
                }}
              />
            </div>
          </div>
        ) : (
          <McpConfigSection config={mcpConfig} onChange={setMcpConfig} />
        )}
      </div>

      {/* Parameters */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground/80">Input Parameters</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define the schema the agent will pass to this tool
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addParameter} className="gap-1.5 h-8">
            <Plus className="h-3.5 w-3.5" />
            Add Parameter
          </Button>
        </div>

        {parameters.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 py-8 text-center">
            <Wrench className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No parameters defined</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              The tool will be called with no input variables
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {parameters.map((param, i) => (
              <ParameterRow
                key={i}
                param={param}
                index={i}
                onChange={(f, v) => updateParameter(i, f, v)}
                onRemove={() => removeParameter(i)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
