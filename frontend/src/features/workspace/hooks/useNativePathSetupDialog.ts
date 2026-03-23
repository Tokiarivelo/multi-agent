import { useState } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';
import { nativePathValidationError } from '../utils/pathValidation';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { revealFolderInExplorer } from '@/features/workflows/api/workflows.api';

export type OS = 'unix' | 'windows' | 'mac';

export function useNativePathSetupDialogLogic(
  workspaceId: string,
  onOpenChange: (open: boolean) => void,
) {
  const { t } = useTranslation('common');
  const updateWorkspaceLocalPath = useWorkspaceStore((s) => s.updateWorkspaceLocalPath);
  const currentPath =
    useWorkspaceStore((s) => s.workspaces.find((w) => w.id === workspaceId)?.nativePath) ?? '';

  const [path, setPath] = useState(currentPath);
  const [os, setOs] = useState<OS>('unix');
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const pathError = path ? nativePathValidationError(path) : null;

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
        toast.success(t('workspace.folderRevealed', 'Folder opened in file manager'));
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

  return {
    t,
    path,
    setPath,
    os,
    setOs,
    copiedCmd,
    revealing,
    pathError,
    canReveal,
    handleRevealFolder,
    handleSave,
    handleCopyCommand,
  };
}
