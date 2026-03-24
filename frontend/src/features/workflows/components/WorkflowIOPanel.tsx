'use client';

/**
 * WorkflowIOPanel
 * ───────────────
 * Lets the user define a workflow's formal "contract":
 *  - inputSchema  : variables the workflow expects to receive (from parent or trigger)
 *  - outputSchema : variables the workflow promises to expose when it finishes
 *
 * Used in WorkflowEditor's right panel, and consumed by SubWorkflowConfig to
 * auto-suggest input/output mappings.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Plus,
  Trash2,
  Star,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WorkflowIOField {
  key: string;
  label?: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
  description?: string;
  required?: boolean;
  defaultValue?: string; // stored as string, coerced by runtime
}

const FIELD_TYPES = ['string', 'number', 'boolean', 'object', 'array', 'any'] as const;

// ─── Empty field factory ─────────────────────────────────────────────────────

function emptyField(): WorkflowIOField {
  return { key: '', type: 'string', required: false };
}

// ─── Single field row ────────────────────────────────────────────────────────

interface FieldRowProps {
  field: WorkflowIOField;
  index: number;
  showRequired: boolean;
  onChange: (f: WorkflowIOField) => void;
  onRemove: () => void;
}

function FieldRow({ field, index, showRequired, onChange, onRemove }: FieldRowProps) {
  const { i18n } = useTranslation();
  const isFr = i18n.language.startsWith('fr');

  return (
    <div className="grid grid-cols-[1fr_100px_auto] gap-2 items-start animate-in fade-in slide-in-from-top-1">
      {/* Key + label */}
      <div className="space-y-1">
        <Input
          id={`io-key-${index}`}
          placeholder={isFr ? 'nom_variable' : 'variable_name'}
          value={field.key}
          onChange={(e) => onChange({ ...field, key: e.target.value.replace(/\s+/g, '_') })}
          className="h-7 text-xs font-mono"
        />
        <Input
          placeholder={isFr ? 'description (optionnel)' : 'description (optional)'}
          value={field.description ?? ''}
          onChange={(e) => onChange({ ...field, description: e.target.value })}
          className="h-6 text-[10px] text-muted-foreground border-dashed"
        />
      </div>

      {/* Type */}
      <Select
        value={field.type}
        onValueChange={(v) => onChange({ ...field, type: v as WorkflowIOField['type'] })}
      >
        <SelectTrigger className="h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FIELD_TYPES.map((t) => (
            <SelectItem key={t} value={t} className="text-xs">
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Actions */}
      <div className="flex items-center gap-1 pt-0.5">
        {showRequired && (
            <button
              type="button"
              title={field.required
                ? (isFr ? 'Requis (cliquer pour rendre optionnel)' : 'Required (click to make optional)')
                : (isFr ? 'Optionnel (cliquer pour rendre requis)' : 'Optional (click to require)')}
              onClick={() => onChange({ ...field, required: !field.required })}
              className={cn(
                'h-7 w-7 rounded flex items-center justify-center transition-colors',
                field.required
                  ? 'text-amber-500 bg-amber-500/10'
                  : 'text-muted-foreground hover:text-amber-500 hover:bg-amber-500/5',
              )}
            >
              <Star className={cn('h-3.5 w-3.5', field.required && 'fill-current')} />
            </button>
          )}
        <button
          type="button"
          onClick={onRemove}
          className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

interface IOSectionProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accentClass: string;
  fields: WorkflowIOField[];
  showRequired: boolean;
  onChange: (fields: WorkflowIOField[]) => void;
  addLabel: string;
}

function IOSection({
  title, subtitle, icon, accentClass, fields, showRequired, onChange, addLabel,
}: IOSectionProps) {
  const handleFieldChange = (i: number, f: WorkflowIOField) => {
    const next = [...fields];
    next[i] = f;
    onChange(next);
  };

  const handleRemove = (i: number) => {
    onChange(fields.filter((_, idx) => idx !== i));
  };

  const handleAdd = () => {
    onChange([...fields, emptyField()]);
  };

  return (
    <div className={cn('rounded-lg border p-3 space-y-3', accentClass)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <p className="text-xs font-semibold">{title}</p>
            <p className="text-[10px] text-muted-foreground">{subtitle}</p>
          </div>
          {fields.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
              {fields.length}
            </Badge>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={handleAdd}
        >
          <Plus className="h-3 w-3" />
          {addLabel}
        </Button>
      </div>

      {/* Column labels */}
      {fields.length > 0 && (
        <div className="grid grid-cols-[1fr_100px_auto] gap-2 px-0.5">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Key</Label>
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Type</Label>
          {showRequired && (
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide pl-1">
              Req
            </span>
          )}
        </div>
      )}

      {/* Rows */}
      <div className="space-y-2">
        {fields.map((f, i) => (
          <FieldRow
            key={f.key || i}
            index={i}
            field={f}
            showRequired={showRequired}
            onChange={(updated) => handleFieldChange(i, updated)}
            onRemove={() => handleRemove(i)}
          />
        ))}
      </div>

      {fields.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic text-center py-1">
          {addLabel} to define the contract…
        </p>
      )}
    </div>
  );
}

// ─── Public component ────────────────────────────────────────────────────────

export interface WorkflowIOPanelProps {
  inputSchema: WorkflowIOField[];
  outputSchema: WorkflowIOField[];
  onInputChange: (fields: WorkflowIOField[]) => void;
  onOutputChange: (fields: WorkflowIOField[]) => void;
}

export function WorkflowIOPanel({
  inputSchema,
  outputSchema,
  onInputChange,
  onOutputChange,
}: WorkflowIOPanelProps) {
  const { i18n } = useTranslation();
  const isFr = i18n.language.startsWith('fr');
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="space-y-3">
      {/* Info banner */}
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => setShowInfo((v) => !v)}
          className="text-muted-foreground hover:text-foreground transition-colors mt-0.5"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
        {showInfo && (
          <p className="text-[11px] text-muted-foreground leading-relaxed animate-in fade-in">
            {isFr
              ? 'Définissez le contrat de ce workflow. Les inputs déclarent ce que le workflow attend en entrée (d\'un autre workflow ou d\'un déclencheur). Les outputs déclarent ce que le workflow expose à la fin.'
              : 'Define this workflow\'s contract. Inputs declare what this workflow expects to receive (from a parent workflow or trigger). Outputs declare what this workflow exposes when it finishes.'}
          </p>
        )}
      </div>

      {/* Inputs */}
      <IOSection
        title={isFr ? 'Variables d\'entrée' : 'Input Variables'}
        subtitle={isFr ? 'Ce que ce workflow reçoit' : 'What this workflow receives'}
        icon={<ArrowDownToLine className="h-3.5 w-3.5 text-sky-500" />}
        accentClass="border-sky-500/20 bg-sky-500/5"
        fields={inputSchema}
        showRequired
        onChange={onInputChange}
        addLabel={isFr ? 'Ajouter un input' : 'Add Input'}
      />

      {/* Outputs */}
      <IOSection
        title={isFr ? 'Variables de sortie' : 'Output Variables'}
        subtitle={isFr ? 'Ce que ce workflow expose' : 'What this workflow exposes'}
        icon={<ArrowUpFromLine className="h-3.5 w-3.5 text-emerald-500" />}
        accentClass="border-emerald-500/20 bg-emerald-500/5"
        fields={outputSchema}
        showRequired={false}
        onChange={onOutputChange}
        addLabel={isFr ? 'Ajouter un output' : 'Add Output'}
      />
    </div>
  );
}
