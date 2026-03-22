import { useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useWorkspace } from './useWorkspace';

/**
 * Hook that periodically refreshes the active workspace file tree 
 * when the watcher is enabled.
 */
export function useWorkspaceWatcher() {
  const watcherEnabled = useWorkspaceStore((s) => s.watcherEnabled);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const { refreshTree } = useWorkspace();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Only poll if watcher is enabled and there's an active workspace
    if (watcherEnabled && activeWorkspaceId) {
      // Periodic refresh every 5 seconds to detect external changes
      intervalRef.current = setInterval(() => {
        refreshTree(activeWorkspaceId);
      }, 5000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [watcherEnabled, activeWorkspaceId, refreshTree]);
}
