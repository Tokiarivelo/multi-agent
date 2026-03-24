import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '@/features/workspace/hooks/useWorkspace';
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore';
import { workspaceStorageService, SavedWorkspace } from '@/features/workspace/services/workspaceStorage';
import { useTranslation } from 'react-i18next';

export function useWorkspaceHeaderMenuLogic() {
  const { t } = useTranslation('common');
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const isLoading = useWorkspaceStore((s) => s.isLoading);
  const {
    openWorkspace,
    closeWorkspace,
    switchWorkspace,
    loadPersistedWorkspaces,
    requestWorkspacePermission,
    openRecentWorkspace,
  } = useWorkspace();

  const hasLoaded = useRef(false);
  const [recentWorkspaces, setRecentWorkspaces] = useState<SavedWorkspace[]>([]);
  const [pathDialogWs, setPathDialogWs] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      loadPersistedWorkspaces();
      workspaceStorageService.loadRecentWorkspaces().then(setRecentWorkspaces);
    }
  }, [loadPersistedWorkspaces]);

  const [menuOpen, setMenuOpen] = useState(false);

  const count = workspaces.length;

  return {
    t,
    workspaces,
    activeWorkspaceId,
    isLoading,
    openWorkspace,
    closeWorkspace,
    switchWorkspace,
    requestWorkspacePermission,
    openRecentWorkspace,
    recentWorkspaces,
    pathDialogWs,
    setPathDialogWs,
    menuOpen,
    setMenuOpen,
    count,
  };
}
