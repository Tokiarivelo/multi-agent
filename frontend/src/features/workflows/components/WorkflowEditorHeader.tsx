'use client';

import { useTranslation } from 'react-i18next';
import {
  Save,
  Play,
  Square,
  Trash2,
  Terminal,
  ChevronLeft,
  PanelRightClose,
  PanelRightOpen,
  ArrowDownToLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Workflow } from '@/types';

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'destructive' | 'warning' | 'secondary'> = {
  DRAFT: 'secondary',
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  ARCHIVED: 'secondary',
};

export interface WorkflowEditorHeaderProps {
  workflow: Workflow | undefined;
  status: string;
  logsOpen: boolean;
  outputLogsToFile: boolean;
  isSaving: boolean;
  isExecuting: boolean;
  isRunning: boolean;
  isCancelling: boolean;
  panelOpen: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onBack: () => void;
  onSave: () => void;
  onExecute: () => void;
  onCancel: () => void;
  onToggleLogs: () => void;
  onTogglePanel: () => void;
  onDelete: () => void;
  onOutputLogsChange: (v: boolean) => void;
}

export function WorkflowEditorHeader({
  workflow,
  status,
  logsOpen,
  outputLogsToFile,
  isSaving,
  isExecuting,
  isRunning,
  isCancelling,
  panelOpen,
  fileInputRef,
  onBack,
  onSave,
  onExecute,
  onCancel,
  onToggleLogs,
  onTogglePanel,
  onDelete,
  onOutputLogsChange,
}: WorkflowEditorHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap p-2 px-4 rounded-xl bg-white/30 dark:bg-black/40 backdrop-blur-md border border-border/50 shadow-sm pointer-events-auto shrink-0 mb-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={onBack}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-2xl font-bold">
          {workflow ? t('workflows.editor.edit') : t('workflows.editor.new')}
        </h2>
        {workflow && <Badge variant={STATUS_VARIANT[status] ?? 'default'}>{status}</Badge>}
      </div>

      <div className="flex items-center gap-2">
        {workflow?.id && !isRunning && (
          <Button
            variant="outline"
            onClick={onExecute}
            disabled={isExecuting || status !== 'ACTIVE'}
            className="gap-2"
            title={status !== 'ACTIVE' ? t('workflows.editor.activateToRun') : t('workflows.actions.run')}
          >
            <Play className="h-4 w-4" />
            {isExecuting ? t('workflows.editor.running') : t('workflows.actions.run')}
          </Button>
        )}

        {workflow?.id && isRunning && (
          <Button
            variant="destructive"
            onClick={onCancel}
            disabled={isCancelling}
            className="gap-2"
          >
            <Square className="h-4 w-4" />
            {isCancelling ? t('workflows.editor.cancelling', 'Cancelling…') : t('workflows.editor.stop', 'Stop')}
          </Button>
        )}

        {workflow?.id && (
          <Button
            variant={logsOpen ? 'secondary' : 'ghost'}
            size="icon"
            onClick={onToggleLogs}
            title={t('workflows.editor.toggleLogs')}
          >
            <Terminal className="h-4 w-4" />
          </Button>
        )}

        {workflow?.id && (
          <div className="flex items-center gap-2 border-l border-border/50 pl-3 ml-1">
            <input
              type="checkbox"
              id="outputLogsToFile"
              checked={outputLogsToFile}
              onChange={(e) => onOutputLogsChange(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 pointer-events-auto"
              title="Output logs into workspace logs/ folder"
            />
            <label htmlFor="outputLogsToFile" className="text-sm cursor-pointer whitespace-nowrap">
              Output Logs
            </label>
          </div>
        )}

        <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
          <ArrowDownToLine className="h-4 w-4" />
          {t('workflows.editor.import', 'Import JSON')}
        </Button>

        <Button onClick={onSave} disabled={isSaving} className="gap-2">
          <Save className="h-4 w-4" />
          {isSaving ? t('workflows.editor.saving') : t('workflows.editor.save')}
        </Button>

        {workflow?.id && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('workflows.editor.deleteTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('workflows.editor.deleteDesc')?.replace('{name}', workflow.name)}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('workflows.editor.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={onDelete}
                >
                  {t('workflows.editor.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onTogglePanel}
          title="Toggle Details Panel"
          className="ml-2 text-muted-foreground hover:text-foreground"
        >
          {panelOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  );
}
