import { create } from 'zustand';
import { workspaceStorageService } from '../services/workspaceStorage';

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface FileNode {
  name: string;
  kind: 'file' | 'directory';
  handle: FileSystemHandle;
  path: string;
  children?: FileNode[];
}

export interface TerminalEntry {
  id: string;
  type: 'input' | 'output' | 'error' | 'info';
  text: string;
  timestamp: Date;
}

/** A single authorised workspace folder */
export interface WorkspaceEntry {
  id: string; // stable random UUID
  name: string; // folder name (dirHandle.name)
  rootHandle: FileSystemDirectoryHandle;
  fileTree: FileNode | null;
  hasPermission: boolean;
  nativePath?: string; // native absolute path for server-side tools
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface WorkspaceState {
  // Multi-workspace registry
  workspaces: WorkspaceEntry[];
  activeWorkspaceId: string | null; // which workspace is shown in the editor pane

  // Editor state for the active workspace
  activeFileHandle: FileSystemFileHandle | null;
  activeFilePath: string | null;
  fileContent: string;
  isDirty: boolean;
  isLoading: boolean;

  // Terminal
  terminalHistory: TerminalEntry[];
  terminalOpen: boolean;
  terminalWorkspaceId: string | null; // which workspace the terminal targets
  currentTerminalPath: string; // The active directory path relative to workspace root

  // ── Workspace CRUD ──
  setWorkspaces: (workspaces: WorkspaceEntry[]) => void;
  addWorkspace: (entry: WorkspaceEntry) => void;
  removeWorkspace: (id: string) => void;
  updateWorkspaceTree: (id: string, tree: FileNode | null) => void;
  updateWorkspacePermission: (id: string, hasPermission: boolean) => void;
  setActiveWorkspaceId: (id: string | null) => void;
  setTerminalWorkspaceId: (id: string | null) => void;
  updateWorkspaceLocalPath: (id: string, path: string) => void;

  // ── Editor ──
  setActiveFileHandle: (handle: FileSystemFileHandle | null, path: string | null) => void;
  setFileContent: (content: string) => void;
  setIsDirty: (dirty: boolean) => void;
  setIsLoading: (loading: boolean) => void;

  // ── Terminal ──
  addTerminalEntry: (entry: Omit<TerminalEntry, 'id' | 'timestamp'>) => void;
  clearTerminal: () => void;
  setTerminalOpen: (open: boolean) => void;
  setCurrentTerminalPath: (path: string) => void;

  // ── Derived helpers ──
  getActiveWorkspace: () => WorkspaceEntry | null;
  getWorkspaceById: (id: string) => WorkspaceEntry | null;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,

  activeFileHandle: null,
  activeFilePath: null,
  fileContent: '',
  isDirty: false,
  isLoading: false,

  terminalHistory: [],
  terminalOpen: false,
  terminalWorkspaceId: null,
  currentTerminalPath: '',

  // ── Workspace CRUD ──────────────────────────────────────────────────────────

  setWorkspaces: (workspaces) =>
    set({
      workspaces,
      activeWorkspaceId: workspaces[0]?.id ?? null,
      terminalWorkspaceId: workspaces[0]?.id ?? null,
    }),

  addWorkspace: (entry) =>
    set((state) => {
      // If already exists by name, merge nativePath if new entry has one
      const existingIdx = state.workspaces.findIndex((w) => w.name === entry.name);
      if (existingIdx !== -1) {
        const existing = state.workspaces[existingIdx];
        // Only merge if incoming entry has a nativePath that the existing one lacks
        if (entry.nativePath && !existing.nativePath) {
          const workspaces = state.workspaces.map((w, i) =>
            i === existingIdx ? { ...w, nativePath: entry.nativePath } : w,
          );
          workspaceStorageService.saveWorkspaces(
            workspaces.map((w) => ({
              id: w.id,
              name: w.name,
              handle: w.rootHandle,
              nativePath: w.nativePath,
            })),
          );
          return { workspaces };
        }
        return state;
      }

      const workspaces = [...state.workspaces, entry];

      // Persist async
      workspaceStorageService.saveWorkspaces(
        workspaces.map((w) => ({
          id: w.id,
          name: w.name,
          handle: w.rootHandle,
          nativePath: w.nativePath,
        })),
      );

      return {
        workspaces,
        activeWorkspaceId: state.activeWorkspaceId ?? entry.id,
        terminalWorkspaceId: state.terminalWorkspaceId ?? entry.id,
      };
    }),

  removeWorkspace: (id) =>
    set((state) => {
      const workspaces = state.workspaces.filter((w) => w.id !== id);

      // Persist async
      workspaceStorageService.saveWorkspaces(
        workspaces.map((w) => ({
          id: w.id,
          name: w.name,
          handle: w.rootHandle,
          nativePath: w.nativePath,
        })),
      );

      let activeWorkspaceId = state.activeWorkspaceId;
      let terminalWorkspaceId = state.terminalWorkspaceId;
      if (activeWorkspaceId === id) activeWorkspaceId = workspaces[0]?.id ?? null;
      if (terminalWorkspaceId === id) terminalWorkspaceId = workspaces[0]?.id ?? null;
      // Reset editor if the active workspace was removed
      const extras =
        state.activeWorkspaceId === id
          ? {
              activeFileHandle: null as null,
              activeFilePath: null as null,
              fileContent: '' as string,
              isDirty: false,
            }
          : {};
      return { workspaces, activeWorkspaceId, terminalWorkspaceId, ...extras };
    }),

  updateWorkspaceTree: (id, tree) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, fileTree: tree } : w)),
    })),

  updateWorkspacePermission: (id, hasPermission) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, hasPermission } : w)),
    })),

  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
  setTerminalWorkspaceId: (id) => set({ terminalWorkspaceId: id, currentTerminalPath: '' }),

  // ── Editor ──────────────────────────────────────────────────────────────────

  setActiveFileHandle: (handle, path) => set({ activeFileHandle: handle, activeFilePath: path }),
  setFileContent: (content) => set({ fileContent: content }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),
  setIsLoading: (loading) => set({ isLoading: loading }),

  // ── Terminal ─────────────────────────────────────────────────────────────────
  updateWorkspaceLocalPath: (id, path) =>
    set((state) => {
      const workspaces = state.workspaces.map((ws) =>
        ws.id === id ? { ...ws, nativePath: path } : ws,
      );

      // Persist to main list
      const saved = workspaces.map((ws) => ({
        id: ws.id,
        name: ws.name,
        handle: ws.rootHandle,
        nativePath: ws.nativePath,
      }));
      workspaceStorageService.saveWorkspaces(saved);

      // Also update its record in the recent list so it's recovered on re-open
      const updated = workspaces.find((w) => w.id === id);
      if (updated) {
        workspaceStorageService.recordRecentWorkspace({
          id: updated.id,
          name: updated.name,
          handle: updated.rootHandle,
          nativePath: updated.nativePath,
        });
      }

      return { workspaces };
    }),
  addTerminalEntry: (entry) =>
    set((state) => ({
      terminalHistory: [
        ...state.terminalHistory,
        { ...entry, id: crypto.randomUUID(), timestamp: new Date() },
      ],
    })),
  clearTerminal: () => set({ terminalHistory: [] }),
  setTerminalOpen: (open) => set({ terminalOpen: open }),
  setCurrentTerminalPath: (path) => set({ currentTerminalPath: path }),

  // ── Derived ──────────────────────────────────────────────────────────────────

  getActiveWorkspace: () => {
    const { workspaces, activeWorkspaceId } = get();
    return workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  },

  getWorkspaceById: (id) => {
    return get().workspaces.find((w) => w.id === id) ?? null;
  },
}));
