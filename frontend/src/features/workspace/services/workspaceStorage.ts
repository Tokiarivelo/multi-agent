import { get, set } from 'idb-keyval';

export interface SavedWorkspace {
  id: string;
  name: string;
  type?: 'local' | 'server';
  handle?: FileSystemDirectoryHandle;
  nativePath?: string;
}

const STORAGE_KEY = 'multi_agent_workspaces';

export const workspaceStorageService = {
  /** Save workspaces array to indexedDB */
  async saveWorkspaces(workspaces: SavedWorkspace[]): Promise<void> {
    try {
      await set(STORAGE_KEY, workspaces);
    } catch (error) {
      console.error('Failed to save workspaces to IndexedDB:', error);
    }
  },

  /** Load workspaces from indexedDB */
  async loadWorkspaces(): Promise<SavedWorkspace[]> {
    try {
      const data = await get<SavedWorkspace[]>(STORAGE_KEY);
      return data || [];
    } catch (error) {
      console.error('Failed to load workspaces from IndexedDB:', error);
      return [];
    }
  },

  /** Manage recent workspaces */
  async loadRecentWorkspaces(): Promise<SavedWorkspace[]> {
    try {
      const data = await get<SavedWorkspace[]>(`${STORAGE_KEY}_recent`);
      return data || [];
    } catch (error) {
      console.error('Failed to load recent workspaces from IndexedDB:', error);
      return [];
    }
  },

  async recordRecentWorkspace(workspace: SavedWorkspace): Promise<void> {
    try {
      const recent = await this.loadRecentWorkspaces();
      const filtered = recent.filter((w) => w.name !== workspace.name);
      filtered.unshift(workspace);
      await set(`${STORAGE_KEY}_recent`, filtered.slice(0, 5)); // Keep last 5
    } catch (error) {
      console.error('Failed to record recent workspace:', error);
    }
  },

  /** Silently check permission for a handle */
  async checkPermission(
    handle: FileSystemHandle,
    mode: 'read' | 'readwrite' = 'readwrite',
  ): Promise<boolean> {
    try {
      const typedHandle = handle as unknown as {
        queryPermission(options: { mode: string }): Promise<string>;
      };
      return (await typedHandle.queryPermission({ mode })) === 'granted';
    } catch (error) {
      console.error('Failed to query permission:', error);
      return false;
    }
  },

  /** Ask user for permission for a handle (requires user gesture) */
  async requestPermission(
    handle: FileSystemHandle,
    mode: 'read' | 'readwrite' = 'readwrite',
  ): Promise<boolean> {
    try {
      const typedHandle = handle as unknown as {
        requestPermission(options: { mode: string }): Promise<string>;
      };
      return (await typedHandle.requestPermission({ mode })) === 'granted';
    } catch (error) {
      console.error('Failed to request permission:', error);
      return false;
    }
  },
};
