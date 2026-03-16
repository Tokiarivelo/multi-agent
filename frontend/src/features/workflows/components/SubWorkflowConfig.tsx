'use client';

/**
 * SubWorkflowConfig
 * -----------------
 * Configuration panel for the SUBWORKFLOW node type.
 * Allows the user to:
 *  1. Pick an existing workflow to call as a sub-process.
 *  2. Auto-suggest input/output mappings from the target workflow's I/O contract.
 *  3. Manually map parent-context variable names → sub-workflow input keys (inputMapping).
 *  4. Manually map sub-workflow output keys → parent-context variable names (outputMapping).
 */

import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { workflowsApi } from '../api/workflows.api';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  X,
  ArrowRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { WorkflowIOField } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MappingEntry {
  from: string;
  to: string;
}

interface SubWorkflowConfigProps {
  config: Record<string, unknown>;
  /** Current workflow ID — excluded from the list to prevent circular references */
  currentWorkflowId?: string;
  onConfigChange: (key: string, value: unknown) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a Record<string,string> config field to MappingEntry[] */
function recordToEntries(rec: unknown): MappingEntry[] {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return [];
  return Object.entries(rec as Record<string, string>).map(([from, to]) => ({ from, to }));
}

/** Convert MappingEntry[] back to Record<string,string> */
function entriesToRecord(entries: MappingEntry[]): Record<string, string> {
  return Object.fromEntries(entries.filter((e) => e.from && e.to).map((e) => [e.from, e.to]));
}

/** Build auto-suggested mappings from the schema fields of the target workflow */
function schemaToEntries(fields: WorkflowIOField[]): MappingEntry[] {
  return fields.map((f) => ({ from: f.key, to: f.key }));
}

// ─── MappingEditor ────────────────────────────────────────────────────────────

function MappingEditor({
  label,
  labelFr,
  fromPlaceholder,
  toPlaceholder,
  hint,
  entries,
  schema,
  onAutoSuggest,
  onChange,
}: {
  label: string;
  labelFr: string;
  fromPlaceholder: string;
  toPlaceholder: string;
  hint?: string;
  entries: MappingEntry[];
  /** Optional schema fields from the target workflow's I/O contract */
  schema?: WorkflowIOField[];
  onAutoSuggest?: () => void;
  onChange: (entries: MappingEntry[]) => void;
}) {
  const { i18n } = useTranslation();
  const isFr = i18n.language.startsWith('fr');

  const add = () => onChange([...entries, { from: '', to: '' }]);
  const remove = (i: number) => onChange(entries.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<MappingEntry>) =>
    onChange(entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">{isFr ? labelFr : label}</Label>
        {schema && schema.length > 0 && onAutoSuggest && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] gap-1 text-violet-500 hover:text-violet-400 hover:bg-violet-500/10 px-2"
            onClick={onAutoSuggest}
            title={
              isFr
                ? 'Remplir depuis le schéma du workflow cible'
                : 'Auto-fill from target workflow schema'
            }
          >
            <Sparkles className="h-3 w-3" />
            {isFr ? 'Auto-remplir' : 'Auto-fill'}
            <Badge variant="secondary" className="text-[9px] px-1 py-0">
              {schema.length}
            </Badge>
          </Button>
        )}
      </div>

      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}

      {/* Schema hints */}
      {schema && schema.length > 0 && entries.length === 0 && (
        <div className="rounded bg-violet-500/5 border border-violet-500/20 px-2 py-1.5 space-y-0.5">
          <p className="text-[10px] text-violet-500 font-medium mb-1">
            {isFr ? 'Champs déclarés :' : 'Declared fields:'}
          </p>
          {schema.map((f) => (
            <div
              key={f.key}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono"
            >
              <span className="text-violet-400">{f.key}</span>
              <span className="text-[9px] opacity-60">:{f.type}</span>
              {f.required && <span className="text-amber-500 text-[9px]">*required</span>}
              {f.description && (
                <span className="opacity-50 font-sans truncate">{f.description}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              className="h-7 text-xs flex-1 font-mono"
              placeholder={fromPlaceholder}
              value={entry.from}
              onChange={(e) => update(i, { from: e.target.value })}
            />
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <Input
              className="h-7 text-xs flex-1 font-mono"
              placeholder={toPlaceholder}
              value={entry.to}
              onChange={(e) => update(i, { to: e.target.value })}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive/50 hover:text-destructive shrink-0"
              onClick={() => remove(i)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5 w-full" onClick={add}>
        <Plus className="h-3 w-3" /> {isFr ? 'Ajouter une correspondance' : 'Add mapping'}
      </Button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SubWorkflowConfig({
  config,
  currentWorkflowId,
  onConfigChange,
}: SubWorkflowConfigProps) {
  const { i18n } = useTranslation();
  const isFr = i18n.language.startsWith('fr');

  const { data: workflowsPage, isLoading } = useQuery({
    queryKey: ['workflows', 'all'],
    queryFn: () => workflowsApi.getAll(1, 100),
  });

  const availableWorkflows = (workflowsPage?.data ?? []).filter((w) => w.id !== currentWorkflowId);

  const selectedId = (config.workflowId as string) ?? '';

  // Find the selected workflow to read its I/O schema
  const selectedWorkflow = useMemo(
    () => availableWorkflows.find((w) => w.id === selectedId),
    [availableWorkflows, selectedId],
  );

  const targetInputSchema: WorkflowIOField[] =
    (selectedWorkflow?.definition?.inputSchema as WorkflowIOField[] | undefined) ?? [];
  const targetOutputSchema: WorkflowIOField[] =
    (selectedWorkflow?.definition?.outputSchema as WorkflowIOField[] | undefined) ?? [];

  const inputEntries = recordToEntries(config.inputMapping);
  const outputEntries = recordToEntries(config.outputMapping);

  const handleInputChange = (entries: MappingEntry[]) => {
    onConfigChange('inputMapping', entriesToRecord(entries));
  };
  const handleOutputChange = (entries: MappingEntry[]) => {
    onConfigChange('outputMapping', entriesToRecord(entries));
  };

  // When workflow changes and has a schema, auto-suggest mappings if not yet defined
  useEffect(() => {
    if (!selectedId) return;
    if (inputEntries.length === 0 && targetInputSchema.length > 0) {
      onConfigChange('inputMapping', entriesToRecord(schemaToEntries(targetInputSchema)));
    }
    if (outputEntries.length === 0 && targetOutputSchema.length > 0) {
      onConfigChange('outputMapping', entriesToRecord(schemaToEntries(targetOutputSchema)));
    }
    // Only react on workflow change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div className="space-y-5">
      {/* Workflow selector */}
      <div className="space-y-1.5">
        <Label className="text-xs">
          {isFr ? 'Workflow cible' : 'Target Workflow'}{' '}
          <span className="text-muted-foreground font-normal">
            {isFr ? '(doit être ACTIF)' : '(must be ACTIVE)'}
          </span>
        </Label>

        {isLoading ? (
          <div className="h-9 rounded-md border border-input bg-muted/30 animate-pulse" />
        ) : availableWorkflows.length > 0 ? (
          <Select value={selectedId} onValueChange={(v) => onConfigChange('workflowId', v)}>
            <SelectTrigger className="h-9 text-sm font-mono">
              <SelectValue
                placeholder={isFr ? 'Sélectionner un workflow…' : 'Select a workflow…'}
              />
            </SelectTrigger>
            <SelectContent>
              {availableWorkflows.map((wf) => (
                <SelectItem key={wf.id} value={wf.id} className="font-mono text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${
                        wf.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                      }`}
                    />
                    {wf.name}
                    {/* Show I/O schema badge if available */}
                    {(wf.definition?.inputSchema?.length ?? 0) +
                      (wf.definition?.outputSchema?.length ?? 0) >
                      0 && (
                      <span className="text-[9px] text-violet-400 ml-1">
                        {wf.definition?.inputSchema?.length ?? 0}↓{' '}
                        {wf.definition?.outputSchema?.length ?? 0}↑
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">{wf.id}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            placeholder="workflow-uuid"
            className="font-mono text-sm"
            value={selectedId}
            onChange={(e) => onConfigChange('workflowId', e.target.value)}
          />
        )}
      </div>

      {/* I/O Contract summary of selected workflow */}
      {selectedWorkflow && (targetInputSchema.length > 0 || targetOutputSchema.length > 0) && (
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2.5 space-y-1.5 text-[11px]">
          <p className="font-semibold text-violet-500 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            {isFr ? 'Contrat I/O déclaré' : 'Declared I/O contract'}
          </p>
          {targetInputSchema.length > 0 && (
            <div className="flex items-start gap-1.5">
              <ArrowDownToLine className="h-3 w-3 text-sky-500 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <span className="text-sky-500 font-medium">{isFr ? 'Inputs:' : 'Inputs:'}</span>{' '}
                {targetInputSchema.map((f) => (
                  <span key={f.key} className="inline-flex items-center gap-1 mr-1.5 font-mono">
                    <span className="text-foreground/80">{f.key}</span>
                    <span className="opacity-50 text-[9px]">:{f.type}</span>
                    {f.required && <span className="text-amber-500 text-[9px]">*</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
          {targetOutputSchema.length > 0 && (
            <div className="flex items-start gap-1.5">
              <ArrowUpFromLine className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <span className="text-emerald-500 font-medium">
                  {isFr ? 'Outputs:' : 'Outputs:'}
                </span>{' '}
                {targetOutputSchema.map((f) => (
                  <span key={f.key} className="inline-flex items-center gap-1 mr-1.5 font-mono">
                    <span className="text-foreground/80">{f.key}</span>
                    <span className="opacity-50 text-[9px]">:{f.type}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Circular-reference warning */}
      {selectedId === currentWorkflowId && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            {isFr
              ? 'Vous ne pouvez pas appeler le workflow courant — cela provoquerait une récursion infinie.'
              : 'You cannot call the current workflow — it would cause infinite recursion.'}
          </span>
        </div>
      )}

      {/* Informational banner */}
      <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2.5 text-[11px] text-blue-600 dark:text-blue-400 space-y-1">
        <p className="font-semibold">
          {isFr ? 'Comment fonctionne le sous-workflow ?' : 'How does it work?'}
        </p>
        <p>
          {isFr
            ? "Le workflow cible s'execute de facon synchrone en tant que noeud. Son output est integre au contexte courant."
            : 'The target workflow runs synchronously as a node. Its output is merged into the current execution context.'}
        </p>
      </div>

      {/* Input Mapping */}
      <MappingEditor
        label="Input Mapping"
        labelFr="Correspondance d'entree"
        fromPlaceholder={isFr ? 'cle parente' : 'parent key'}
        toPlaceholder={isFr ? 'cle sous-workflow' : 'sub-wf key'}
        hint={
          isFr
            ? "Mappe une variable du contexte parent vers une cle d'entree du sous-workflow."
            : 'Maps a parent-context variable name => a sub-workflow input key.'
        }
        schema={targetInputSchema}
        onAutoSuggest={() => handleInputChange(schemaToEntries(targetInputSchema))}
        entries={inputEntries}
        onChange={handleInputChange}
      />

      {/* Output Mapping */}
      <MappingEditor
        label="Output Mapping"
        labelFr="Correspondance de sortie"
        fromPlaceholder={isFr ? 'cle sous-workflow' : 'sub-wf key'}
        toPlaceholder={isFr ? 'cle parente' : 'parent key'}
        hint={
          isFr
            ? "Copie une valeur de la sortie du sous-workflow vers l'espace de noms parent."
            : 'Copies a value from the sub-workflow output into the parent namespace.'
        }
        schema={targetOutputSchema}
        onAutoSuggest={() => handleOutputChange(schemaToEntries(targetOutputSchema))}
        entries={outputEntries}
        onChange={handleOutputChange}
      />

      {/* Output shape */}
      <div className="rounded-md bg-muted/30 border border-border/40 p-3 text-[11px] text-muted-foreground font-mono space-y-0.5">
        <p className="font-semibold text-foreground/70 mb-1">
          {isFr ? 'Forme de la sortie :' : 'Output shape:'}
        </p>
        <p>{'{'}</p>
        {targetOutputSchema.length > 0 ? (
          targetOutputSchema.map((f) => (
            <p key={f.key} className="pl-4">
              <span className="text-emerald-500">{f.key}</span>
              <span className="opacity-50">: {f.type}</span>
              {f.description && (
                <span className="font-sans opacity-40 ml-2">{`// ${f.description}`}</span>
              )}
            </p>
          ))
        ) : (
          <p className="pl-4">{'...allSubWorkflowVariables'}</p>
        )}
        <p className="pl-4">
          {'_subWorkflowId: string '}
          <span className="font-sans opacity-50">{'// workflow id'}</span>
        </p>
        <p className="pl-4">
          {'_subExecutionId: string '}
          <span className="font-sans opacity-50">{'// child execution id'}</span>
        </p>
        <p className="pl-4">
          {'_subWorkflowName: string '}
          <span className="font-sans opacity-50">{'// workflow name'}</span>
        </p>
        <p>{'}'}</p>
      </div>
    </div>
  );
}
