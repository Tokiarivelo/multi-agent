'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { NODE_TYPE_REGISTRY, NodeTypeMeta, NodeTypeId } from './nodeTypes';
import { AddNodePayload } from '../api/workflows.api';
import { v4 as uuidv4 } from 'uuid';
import { useTheme } from 'next-themes';
import Editor from '@monaco-editor/react';
import { Resizable } from 're-resizable';
import { FileConfigEditor } from './FileConfigEditor';

interface NodeEditorProps {
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
  isSaving?: boolean;
  /** Existing agents for AGENT node dropdown */
  agents?: { id: string; name: string }[];
  /** Existing tools for TOOL node dropdown  */
  tools?: { id: string; name: string }[];
}

/** Inner form — keyed on `initialNode` so it remounts (and resets) cleanly */
function NodeEditorForm({
  open,
  onClose,
  onSave,
  initialNode,
  isSaving,
  agents = [],
  tools = [],
}: NodeEditorProps) {
  const { t, i18n } = useTranslation();
  const { resolvedTheme } = useTheme();

  const isEdit = !!initialNode?.id;

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [type, setType] = useState<NodeTypeId>((initialNode?.type as NodeTypeId) ?? 'AGENT');
  const [config, setConfig] = useState<Record<string, unknown>>(initialNode?.config ?? {});
  const [customName, setCustomName] = useState<string>(initialNode?.customName ?? '');

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

  const handleSave = () => {
    onSave({
      id: initialNode?.id ?? uuidv4(),
      type,
      customName: customName.trim() || undefined,
      config,
      position: initialNode?.position ?? { x: 100, y: 100 },
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

            {/* START / END — no extra config */}
            {(type === 'START' || type === 'END') && (
              <p className="text-sm text-muted-foreground italic">
                {t('workflows.node_editor.noConfig', {
                  label: i18n.language.startsWith('fr') ? meta.labelFr : meta.label,
                })}
              </p>
            )}
          </CardContent>

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
    />
  );
}
