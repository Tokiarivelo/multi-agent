'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FolderOpen,
  Terminal,
  ClipboardCopy,
  Check,
  ArrowRight,
  AlertTriangle,
  Laptop,
  Apple,
  Monitor,
} from 'lucide-react';
import { useWorkspaceStore } from '../store/workspaceStore';
import { nativePathValidationError } from '../utils/pathValidation';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { revealFolderInExplorer } from '@/features/workflows/api/workflows.api';

interface NativePathSetupDialogProps {
  workspaceId: string;
  workspaceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type OS = 'unix' | 'windows' | 'mac';

const STEPS = (os: OS) => [
  {
    icon: <FolderOpen className="h-4 w-4 text-amber-500" />,
    title: os === 'windows' ? 'Open File Explorer' : 'Open Finder / Files',
    description:
      os === 'windows'
        ? 'Navigate to the folder you opened as your workspace.'
        : 'Navigate to the folder you opened as your workspace in Finder.',
  },
  {
    icon: <Terminal className="h-4 w-4 text-emerald-500" />,
    title: 'Open a terminal in that folder',
    description:
      os === 'windows'
        ? 'Right-click inside the folder → "Open in Terminal" (or PowerShell).'
        : os === 'mac'
          ? 'Right-click the folder → "New Terminal at Folder". Or drag the folder into Terminal.'
          : 'Right-click inside the folder → "Open Terminal Here".',
  },
  {
    icon: <ClipboardCopy className="h-4 w-4 text-sky-500" />,
    title: 'Run the print-path command',
    description: 'Copy and run this command in your terminal:',
    command: os === 'windows' ? 'cd' : 'echo $PWD',
  },
  {
    icon: <Check className="h-4 w-4 text-lime-500" />,
    title: 'Paste the output below',
    description:
      'The command prints the absolute path. Copy it from the terminal and paste it in the field below.',
  },
];

export function NativePathSetupDialog({
  workspaceId,
  workspaceName,
  open,
  onOpenChange,
}: NativePathSetupDialogProps) {
  const { t } = useTranslation('common');
  const updateWorkspaceLocalPath = useWorkspaceStore((s) => s.updateWorkspaceLocalPath);
  const currentPath =
    useWorkspaceStore((s) => s.workspaces.find((w) => w.id === workspaceId)?.nativePath) ?? '';

  const [path, setPath] = useState(currentPath);
  const [os, setOs] = useState<OS>('unix');
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const pathError = path ? nativePathValidationError(path) : null;

  // The effective path to reveal: prefer whatever is currently typed (if valid), else saved path
  const revealPath = !nativePathValidationError(path) && path ? path : currentPath;
  const canReveal = !!(revealPath && !nativePathValidationError(revealPath));

  const handleRevealFolder = async () => {
    if (!canReveal) return;
    setRevealing(true);
    try {
      const result = await revealFolderInExplorer(revealPath);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to open folder');
      } else {
        toast.success(
          t('workspace.folderRevealed', 'Folder opened in file manager'),
        );
      }
    } catch {
      toast.error(t('workspace.revealFailed', 'Could not open the file manager. Is the server running locally?'));
    } finally {
      setRevealing(false);
    }
  };

  const handleSave = () => {
    const err = nativePathValidationError(path);
    if (err) {
      toast.error(err);
      return;
    }
    updateWorkspaceLocalPath(workspaceId, path.trim());
    toast.success(t('workspace.nativePathSaved', 'Server path saved successfully'));
    onOpenChange(false);
  };

  const handleCopyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const steps = STEPS(os);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-lime-500" />
            {t('workspace.setServerPath', 'Set Server Path')}
            <Badge variant="secondary" className="font-mono text-xs">
              {workspaceName}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {t(
              'workspace.serverPathDesc',
              'The absolute path to this workspace folder on your machine, used by SHELL nodes as their working directory.',
            )}
          </DialogDescription>
        </DialogHeader>

        {/* OS switcher */}
        <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg w-fit">
          {([['unix', 'Linux', Laptop], ['mac', 'macOS', Apple], ['windows', 'Windows', Monitor]] as const).map(
            ([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setOs(id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                  os === id
                    ? 'bg-background shadow text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ),
          )}
        </div>

        {/* Step-by-step tutorial */}
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3 items-start">
              <div className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-bold text-muted-foreground mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 font-medium text-sm text-foreground">
                  {step.icon}
                  {step.title}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>

                {/* Step 1: Open in file manager button */}
                {i === 0 && (
                  <button
                    onClick={handleRevealFolder}
                    disabled={!canReveal || revealing}
                    className={cn(
                      'mt-1.5 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-all',
                      canReveal && !revealing
                        ? 'border-lime-500/40 text-lime-600 dark:text-lime-400 bg-lime-500/5 hover:bg-lime-500/15'
                        : 'border-border/40 text-muted-foreground cursor-not-allowed opacity-50',
                    )}
                    title={canReveal ? 'Open this folder in your file manager' : 'Set a valid server path first'}
                  >
                    <FolderOpen className="h-3 w-3" />
                    {revealing
                      ? t('workspace.revealing', 'Opening…')
                      : t('workspace.openInFileManager',
                          os === 'windows' ? 'Open in Explorer' :
                          os === 'mac' ? 'Open in Finder' : 'Open in Files')}
                  </button>
                )}

                {step.command && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="flex-1 font-mono text-xs bg-zinc-900 dark:bg-zinc-950 text-lime-400 px-3 py-1.5 rounded-md border border-zinc-700">
                      {step.command}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleCopyCommand(step.command!)}
                      title="Copy command"
                    >
                      {copiedCmd ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <ClipboardCopy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>

        {/* Divider */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border/60" />
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex-1 h-px bg-border/60" />
        </div>

        {/* Input field */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t('workspace.absolutePath', 'Absolute Path')}
          </label>
          <Input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder={os === 'windows' ? 'C:\\Users\\you\\workspace' : '/home/you/workspace'}
            className={cn(
              'font-mono text-sm',
              pathError && 'border-destructive focus-visible:ring-destructive/30',
              !pathError && path && 'border-lime-500/50 focus-visible:ring-lime-500/20',
            )}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          {pathError && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {pathError}
            </p>
          )}
          {!pathError && path && (
            <p className="flex items-center gap-1 text-xs text-lime-600 dark:text-lime-400">
              <Check className="h-3 w-3 shrink-0" />
              {t('workspace.pathLooksGood', 'Path looks valid!')}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!path || !!pathError}
            className="bg-lime-600 hover:bg-lime-700 text-white"
          >
            {t('common.save', 'Save Path')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
