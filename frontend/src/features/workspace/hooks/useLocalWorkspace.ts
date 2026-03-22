import { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';
import { workspaceStorageService, SavedWorkspace } from '../services/workspaceStorage';
import { useWorkspace } from '../hooks/useWorkspace';
import { useIsClient } from '@/hooks/useIsClient';

export function useLocalWorkspaceLogic() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeFilePath = useWorkspaceStore((s) => s.activeFilePath);
  const isDirty = useWorkspaceStore((s) => s.isDirty);
  const isLoading = useWorkspaceStore((s) => s.isLoading);
  const terminalOpen = useWorkspaceStore((s) => s.terminalOpen);
  const terminalWorkspaceId = useWorkspaceStore((s) => s.terminalWorkspaceId);
  const setTerminalOpen = useWorkspaceStore((s) => s.setTerminalOpen);
  const setTerminalWorkspaceId = useWorkspaceStore((s) => s.setTerminalWorkspaceId);
  const updateWorkspaceLocalPath = useWorkspaceStore((s) => s.updateWorkspaceLocalPath);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  const {
    openWorkspace,
    openFile,
    saveFile,
    closeWorkspace,
    switchWorkspace,
    refreshTree,
    requestWorkspacePermission,
    openRecentWorkspace,
    createItem,
  } = useWorkspace();

  const isClient = useIsClient();
  const isApiSupported = isClient && typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  const [recentWorkspaces, setRecentWorkspaces] = useState<SavedWorkspace[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Derived state: Use manual folder selection if set, otherwise follow active file path
  const selectedTreePath = selectedFolder ?? activeFilePath;

  // Load recent workspaces if none are open
  useEffect(() => {
    if (workspaces.length === 0) {
      workspaceStorageService.loadRecentWorkspaces().then(setRecentWorkspaces);
    }
  }, [workspaces.length]);

  // Provide a way to refresh recent workspaces list
  const loadRecentWorkspaces = () => {
    workspaceStorageService.loadRecentWorkspaces().then(setRecentWorkspaces);
  };

  return {
    workspaces,
    activeWorkspaceId,
    activeFilePath,
    isDirty,
    isLoading,
    terminalOpen,
    terminalWorkspaceId,
    setTerminalOpen,
    setTerminalWorkspaceId,
    updateWorkspaceLocalPath,
    activeWorkspace,
    openWorkspace,
    openFile,
    saveFile,
    closeWorkspace,
    switchWorkspace,
    refreshTree,
    requestWorkspacePermission,
    openRecentWorkspace,
    createItem,
    isClient,
    isApiSupported,
    recentWorkspaces,
    selectedFolder,
    setSelectedFolder,
    selectedTreePath,
    loadRecentWorkspaces,
  };
}
