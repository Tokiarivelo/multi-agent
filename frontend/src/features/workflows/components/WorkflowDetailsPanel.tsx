'use client';

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WorkflowIOPanel, WorkflowIOField } from './WorkflowIOPanel';
import { Workflow } from '@/types';

const STATUS_OPTIONS = ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;

export interface WorkflowDetailsPanelProps {
  workflow: Workflow | undefined;
  name: string;
  description: string;
  status: string;
  inputSchema: WorkflowIOField[];
  outputSchema: WorkflowIOField[];
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onInputSchemaChange: (v: WorkflowIOField[]) => void;
  onOutputSchemaChange: (v: WorkflowIOField[]) => void;
}

export function WorkflowDetailsPanel({
  workflow,
  name,
  description,
  status,
  inputSchema,
  outputSchema,
  onNameChange,
  onDescriptionChange,
  onStatusChange,
  onInputSchemaChange,
  onOutputSchemaChange,
}: WorkflowDetailsPanelProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="w-[400px] h-full flex flex-col gap-4 overflow-y-auto pointer-events-auto pb-4 pr-1">
      <Card className="backdrop-blur-xl bg-white/40 dark:bg-black/40 border-border/50 shadow-xl shrink-0">
        <CardHeader>
          <CardTitle className="text-base">{t('workflows.editor.details')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="wf-name" className="text-sm font-medium">
                {t('workflows.editor.nameLabel')}
              </label>
              <Input
                id="wf-name"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder={t('workflows.editor.namePlaceholder')}
                required
              />
            </div>
            {workflow && (
              <div className="space-y-2">
                <label htmlFor="wf-status" className="text-sm font-medium">
                  {t('workflows.editor.status')}
                </label>
                <Select value={status} onValueChange={onStatusChange}>
                  <SelectTrigger id="wf-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="wf-description" className="text-sm font-medium">
              {t('workflows.editor.descLabel')}
            </label>
            <Textarea
              id="wf-description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder={t('workflows.editor.descPlaceholder')}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="backdrop-blur-xl bg-white/40 dark:bg-black/40 border-border/50 shadow-xl shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <span>{i18n.language.startsWith('fr') ? 'Contrat I/O' : 'I/O Contract'}</span>
            <Badge variant="secondary" className="text-[10px] font-normal">
              {inputSchema.length + outputSchema.length} fields
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WorkflowIOPanel
            inputSchema={inputSchema}
            outputSchema={outputSchema}
            onInputChange={onInputSchemaChange}
            onOutputChange={onOutputSchemaChange}
          />
        </CardContent>
      </Card>
    </div>
  );
}
