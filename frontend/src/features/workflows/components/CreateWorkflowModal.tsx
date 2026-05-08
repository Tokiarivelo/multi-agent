'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useCreateWorkflow } from '../hooks/useWorkflows';
import { AiWorkflowResult } from '../api/workflows.api';
import { useQueryClient } from '@tanstack/react-query';
import { CreateWorkflowAiTab, AiTabSession, EMPTY_AI_TAB_SESSION } from './CreateWorkflowAiTab';

interface CreateWorkflowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ManualTab({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const createWorkflow = useCreateWorkflow();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError(t('workflows.create.nameRequired'));
      return;
    }
    setNameError('');
    createWorkflow.mutate(
      { name: name.trim(), description: description.trim() || undefined },
      { onSuccess: onCreated },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label htmlFor="wf-name-manual">{t('workflows.editor.nameLabel')}</Label>
        <Input
          id="wf-name-manual"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError('');
          }}
          placeholder={t('workflows.editor.namePlaceholder')}
          autoFocus
        />
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wf-desc-manual">{t('workflows.editor.descLabel')}</Label>
        <Textarea
          id="wf-desc-manual"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('workflows.editor.descPlaceholder')}
          rows={3}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={createWorkflow.isPending}
        >
          {t('workflows.editor.cancel')}
        </Button>
        <Button type="submit" disabled={createWorkflow.isPending}>
          {createWorkflow.isPending ? t('workflows.create.creating') : t('workflows.create.submit')}
        </Button>
      </div>
    </form>
  );
}

export function CreateWorkflowModal({ open, onOpenChange }: CreateWorkflowModalProps) {
  const { t } = useTranslation();
  const createWorkflow = useCreateWorkflow();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'manual' | 'ai'>('manual');
  const [aiSession, setAiSession] = useState<AiTabSession>(EMPTY_AI_TAB_SESSION);

  const handleClose = () => onOpenChange(false);

  const handleAiApply = (result: AiWorkflowResult) => {
    if (!result.definition) return;
    createWorkflow.mutate(
      {
        name: result.name ?? 'AI Generated Workflow',
        description: result.description,
        definition: result.definition,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['agents'] });
          queryClient.invalidateQueries({ queryKey: ['tools'] });
          setAiSession(EMPTY_AI_TAB_SESSION);
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to create workflow');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('workflows.create.title')}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-1 border-b border-border/50 pb-2 mb-1">
          <Button
            size="sm"
            variant={tab === 'manual' ? 'default' : 'ghost'}
            className="gap-1.5 h-7 text-xs"
            onClick={() => setTab('manual')}
          >
            <Pencil className="h-3 w-3" />
            {t('workflows.create.tabManual')}
          </Button>
          <Button
            size="sm"
            variant={tab === 'ai' ? 'default' : 'ghost'}
            className="gap-1.5 h-7 text-xs"
            onClick={() => setTab('ai')}
          >
            <Sparkles className="h-3 w-3" />
            {t('workflows.create.tabAi')}
          </Button>
        </div>
        {tab === 'manual' && <ManualTab onCreated={handleClose} onCancel={handleClose} />}
        {tab === 'ai' && (
          <CreateWorkflowAiTab
            session={aiSession}
            onSessionUpdate={setAiSession}
            onApply={handleAiApply}
            onCancel={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
