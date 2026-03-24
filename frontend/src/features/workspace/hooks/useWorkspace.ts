import { useCallback } from 'react';
import { useWorkspaceStore, FileNode, WorkspaceEntry } from '../store/workspaceStore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { workspaceStorageService, SavedWorkspace } from '../services/workspaceStorage';
import { workflowsApi } from '../../workflows/api/workflows.api';
import { fileIndexingApi } from '../api/fileIndexingApi';
import { createIgnoreFilter } from '../utils/gitignore';
import { Ignore } from 'ignore';

// ─── FS utilities (exported for WS bridge) ───────────────────────────────────

const IGNORED_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.cache']);

const dirname = (p: string) => {
  const parts = p.split('/').filter(Boolean);
  if (parts.length <= 1) return '/';
  return '/' + parts.slice(0, -1).join('/');
};

/** Recursively build a FileNode tree from a directory handle */
export async function buildFileTree(
  dirHandle: FileSystemDirectoryHandle,
  basePath: string = '',
  ig?: Ignore,
): Promise<FileNode[]> {
  const nodes: FileNode[] = [];

  // If no ignore provided, check for .gitignore at this EXACT level (usually root)
  let currentIg = ig;
  if (!basePath) {
    try {
      const gitignoreHandle = await dirHandle.getFileHandle('.gitignore');
      const file = await gitignoreHandle.getFile();
      const content = await file.text();
      currentIg = createIgnoreFilter(content);
    } catch {
      // no .gitignore at root
    }
  }

  // @ts-expect-error File System Access API types might not be fully available
  for await (const entry of dirHandle.values()) {
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    
    // Skip if ignored by global hardcoded dirs or .gitignore
    if (IGNORED_DIRS.has(entry.name)) continue;
    if (currentIg && currentIg.ignores(relativePath)) continue;

    if (entry.kind === 'file') {
      nodes.push({
        name: entry.name,
        kind: 'file',
        handle: entry,
        path: `/${relativePath}`, // Ensure leading slash for consistency
      });
    } else if (entry.kind === 'directory') {
      const children = await buildFileTree(
        entry as FileSystemDirectoryHandle,
        relativePath,
        currentIg,
      );
      nodes.push({
        name: entry.name,
        kind: 'directory',
        handle: entry,
        path: `/${relativePath}`,
        children,
      });
    }
  }
  
  nodes.sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1,
  );
  return nodes;
}

/** Recursively build a FileNode tree from a backend path */
export async function buildFileTreeServer(
  rootPath: string,
): Promise<FileNode> {
  const data = await workflowsApi.getWorkspaceTree(rootPath);
  
  const mapNode = (n: { name: string; kind: 'file' | 'directory'; path: string; children?: (typeof n)[] }): FileNode => ({
    name: n.name,
    kind: n.kind,
    path: n.path,
    children: n.children?.map(mapNode),
  });

  return mapNode(data);
}

async function resolveDirHandle(
  root: FileSystemDirectoryHandle,
  parts: string[],
  create = false,
): Promise<FileSystemDirectoryHandle> {
  let current: FileSystemDirectoryHandle = root;
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      // Browsers do not support navigating up the tree from a directory handle directly.
      // We handle .. navigation logically through `resolvePath` path resolution before this stage
      throw new Error("Cannot use '..' directly in directory resolution. Root access restricted.");
    }
    current = await current.getDirectoryHandle(part, { create });
  }
  return current;
}

/** Read a file at a path relative to the given root handle */
export async function readFileAtPath(
  root: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<string> {
  const parts = relativePath.split('/').filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) throw new Error('Invalid path: no filename');
  const dir = parts.length > 0 ? await resolveDirHandle(root, parts) : root;
  const fileHandle = await dir.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  return file.text();
}

/** Write content to a file at a path relative to the given root handle */
export async function writeFileAtPath(
  root: FileSystemDirectoryHandle,
  relativePath: string,
  content: string,
): Promise<void> {
  const parts = relativePath.split('/').filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) throw new Error('Invalid path: no filename');
  const dir = parts.length > 0 ? await resolveDirHandle(root, parts, true) : root;
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function createDirAtPath(
  root: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<void> {
  const parts = relativePath.split('/').filter(Boolean);
  await resolveDirHandle(root, parts, true);
}

async function listDirAtPath(
  root: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<{ name: string; kind: string }[]> {
  const parts = relativePath.split('/').filter((p) => p && p !== '.' && p !== '~');
  const dir = parts.length > 0 ? await resolveDirHandle(root, parts) : root;
  const entries: { name: string; kind: string }[] = [];
  // @ts-expect-error File System Access API types might not be fully available
  for await (const entry of dir.values()) {
    entries.push({ name: entry.name, kind: entry.kind });
  }
  return entries.sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1,
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useWorkspace = () => {
  const { t } = useTranslation('common');

  // ── Open / add a new workspace ─────────────────────────────────────────────

  const openWorkspace = useCallback(async () => {
    const store = useWorkspaceStore.getState();
    const isApiSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
    
    if (!isApiSupported) {
      const path = window.prompt(t('workspace.enterAbsolutePath', 'Enter absolute path for workspace:'));
      if (!path) return;

      try {
        store.setIsLoading(true);
        const tree = await buildFileTreeServer(path);
        const entry: WorkspaceEntry = {
          id: crypto.randomUUID(),
          name: tree.name,
          type: 'server',
          fileTree: tree,
          hasPermission: true,
          nativePath: path,
        };
        store.addWorkspace(entry);
        toast.success(t('workspace.opened', 'Workspace opened successfully'));
        return;
      } catch (error) {
        console.error('Error opening server workspace:', error);
        toast.error(t('workspace.openError', 'Failed to open workspace'));
        return;
      } finally {
        store.setIsLoading(false);
      }
    }

    try {
      store.setIsLoading(true);
      // @ts-expect-error File System Access API types might not be fully available
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });

      // Check if already registered
      const existing = store.workspaces.find((w) => w.name === dirHandle.name);
      if (existing) {
        // If the existing entry has no nativePath, try to restore it from recent
        if (!existing.nativePath) {
          const recent = await workspaceStorageService.loadRecentWorkspaces();
          let matchedRecent: SavedWorkspace | undefined;
          for (const r of recent) {
            try {
              if (r.handle && (await r.handle.isSameEntry(dirHandle))) {
                matchedRecent = r;
                break;
              }
            } catch {
              /* ignore */
            }
          }
          if (!matchedRecent) matchedRecent = recent.find((r) => r.name === dirHandle.name);
          if (matchedRecent?.nativePath) {
            store.updateWorkspaceLocalPath(existing.id, matchedRecent.nativePath);
          }
        }
        toast.info(t('workspace.alreadyOpen', `"${dirHandle.name}" is already open`));
        store.setActiveWorkspaceId(existing.id);
        return;
      }

      const children = await buildFileTree(dirHandle);
      const recent = await workspaceStorageService.loadRecentWorkspaces();

      // Robust matching: identity check (handle.isSameEntry) or name heuristic
      let matchedRecent: SavedWorkspace | undefined;
      for (const r of recent) {
        try {
          if (r.handle && (await r.handle.isSameEntry(dirHandle))) {
            matchedRecent = r;
            break;
          }
        } catch {
          // Fallback if handle is no longer valid or isSameEntry not supported
        }
      }

      if (!matchedRecent) {
        matchedRecent = recent.find((r) => r.name === dirHandle.name);
      }

      const entry: WorkspaceEntry = {
        id: matchedRecent?.id ?? crypto.randomUUID(),
        name: dirHandle.name,
        type: 'local',
        rootHandle: dirHandle,
        fileTree: {
          name: dirHandle.name,
          kind: 'directory',
          handle: dirHandle,
          path: `/${dirHandle.name}`,
          children,
        },
        hasPermission: true,
        nativePath: matchedRecent?.nativePath,
      };

      store.addWorkspace(entry);
      store.addTerminalEntry({ type: 'info', text: `Workspace added: ${dirHandle.name}` });
      await workspaceStorageService.recordRecentWorkspace({
        id: entry.id,
        name: entry.name,
        handle: entry.rootHandle,
        nativePath: entry.nativePath,
      });
      toast.success(t('workspace.opened', 'Workspace opened successfully'));
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error opening workspace:', error);
        toast.error(t('workspace.openError', 'Failed to open workspace'));
      }
    } finally {
      store.setIsLoading(false);
    }
  }, [t]);

  // ── Open a recently loaded workspace ───────────────────────────────────────

  const openRecentWorkspace = useCallback(
    async (saved: import('../services/workspaceStorage').SavedWorkspace) => {
      const store = useWorkspaceStore.getState();
      try {
        store.setIsLoading(true);
        const existing = store.workspaces.find((w) => w.id === saved.id || w.name === saved.name);
        if (existing) {
          store.setActiveWorkspaceId(existing.id);
          return;
        }

        let children: import('../store/workspaceStore').FileNode[] | null = null;
        let storagePermission = true;

        if (saved.handle && saved.type === 'local') {
          const hasPermission = await workspaceStorageService.checkPermission(saved.handle);
          if (hasPermission) {
            try {
              children = await buildFileTree(saved.handle as FileSystemDirectoryHandle);
            } catch (e) {
              console.warn('Failed to build tree for permitted handle', e);
            }
          }
          storagePermission = hasPermission;
        }

        const entry: import('../store/workspaceStore').WorkspaceEntry = {
          id: saved.id,
          name: saved.name,
          type: saved.type ?? 'local',
          rootHandle: saved.handle as FileSystemDirectoryHandle,
          fileTree: children
            ? {
                name: saved.name,
                kind: 'directory',
                handle: saved.handle,
                path: `/${saved.name}`,
                children,
              }
            : null,
          hasPermission: storagePermission,
          nativePath: saved.nativePath,
        };

        store.addWorkspace(entry);
        store.addTerminalEntry({
          type: 'info',
          text: `Workspace added from recent: ${saved.name}`,
        });

        if (!storagePermission) {
          toast.info(t('workspace.needsPermission', 'Workspace opened, but needs permission'));
        } else {
          toast.success(t('workspace.opened', 'Workspace opened successfully'));
        }
      } catch (error) {
        console.error('Error opening recent workspace:', error);
        toast.error(t('workspace.openError', 'Failed to open workspace'));
      } finally {
        store.setIsLoading(false);
      }
    },
    [t],
  );

  // ── Load persisted workspaces from IndexedDB ───────────────────────────────

  const loadPersistedWorkspaces = useCallback(async () => {
    const store = useWorkspaceStore.getState();
    try {
      store.setIsLoading(true);
      const savedList = await workspaceStorageService.loadWorkspaces();
      if (savedList.length === 0) return;

      const entries: WorkspaceEntry[] = await Promise.all(
        savedList.map(async (saved) => {
          let hasPermission = true;
          let children: FileNode[] | null = null;

          if (saved.type === 'local' && saved.handle) {
            // Check if we already have permission without prompting
            hasPermission = await workspaceStorageService.checkPermission(saved.handle);

            if (hasPermission) {
              try {
                children = await buildFileTree(saved.handle as FileSystemDirectoryHandle);
              } catch (e) {
                console.warn('Failed to build tree for permitted handle', e);
              }
            }
          }

          return {
            id: saved.id,
            name: saved.name,
            type: saved.type ?? 'local',
            rootHandle: saved.handle as FileSystemDirectoryHandle,
            fileTree: children
              ? {
                  name: saved.name,
                  kind: 'directory',
                  handle: saved.handle,
                  path: `/${saved.name}`,
                  children,
                }
              : null,
            hasPermission,
            nativePath: saved.nativePath,
          };
        }),
      );

      store.setWorkspaces(entries);
      if (entries.some((e) => !e.hasPermission)) {
        toast.info(t('workspace.needsPermission', 'Some workspaces need permission to reconnect'));
      }
    } catch (error) {
      console.error('Failed to load persisted workspaces:', error);
    } finally {
      store.setIsLoading(false);
    }
  }, [t]);

  // ─── Request permission for a disconnected workspace ────────────────────────
  
  const ensureWorkspacePermission = useCallback(
    async (id: string, mode: 'read' | 'readwrite' = 'readwrite'): Promise<boolean> => {
      const store = useWorkspaceStore.getState();
      const ws = store.getWorkspaceById(id);
      if (!ws || ws.type !== 'local' || !ws.rootHandle) return true;

      // check status in store and verify with browser
      const hasPermission = await workspaceStorageService.checkPermission(ws.rootHandle, mode);
      if (hasPermission) {
        if (!ws.hasPermission) store.updateWorkspacePermission(id, true);
        return true;
      }

      // Need to request
      const granted = await workspaceStorageService.requestPermission(ws.rootHandle, mode);
      if (granted) {
        store.updateWorkspacePermission(id, true);
        // If it was lost, we might need to rebuild the tree
        if (!ws.fileTree) {
          const children = await buildFileTree(ws.rootHandle);
          store.updateWorkspaceTree(id, {
            name: ws.name,
            kind: 'directory',
            handle: ws.rootHandle,
            path: `/${ws.name}`,
            children,
          });
        }
        return true;
      }
      return false;
    },
    [],
  );

  // ── Request permission for a disconnected workspace ────────────────────────

  const requestWorkspacePermission = useCallback(
    async (id: string) => {
      const store = useWorkspaceStore.getState();
      const ws = store.getWorkspaceById(id);
      if (!ws || ws.type !== 'local' || !ws.rootHandle) return;
      try {
        store.setIsLoading(true);
        const granted = await workspaceStorageService.requestPermission(ws.rootHandle);
        if (granted) {
          store.updateWorkspacePermission(id, true);
          const children = await buildFileTree(ws.rootHandle);
          store.updateWorkspaceTree(id, {
            name: ws.name,
            kind: 'directory',
            handle: ws.rootHandle,
            path: `/${ws.name}`,
            children,
          });
          toast.success(t('workspace.permissionGranted', 'Permission granted successfully'));
        } else {
          toast.error(t('workspace.permissionDenied', 'Permission denied'));
        }
      } catch (error) {
        console.error('Failed to request permission:', error);
        toast.error(t('workspace.verifyError', 'Failed to verify permission'));
      } finally {
        store.setIsLoading(false);
      }
    },
    [t],
  );

  // ── Remove a workspace ─────────────────────────────────────────────────────

  const closeWorkspace = useCallback(
    (id?: string) => {
      const store = useWorkspaceStore.getState();
      const targetId = id ?? store.activeWorkspaceId;
      if (!targetId) return;
      if (store.isDirty && store.activeWorkspaceId === targetId) {
        const confirm = window.confirm(
          t('workspace.unsavedChanges', 'You have unsaved changes. Discard?'),
        );
        if (!confirm) return;
      }
      store.removeWorkspace(targetId);
    },
    [t],
  );

  // ── Switch the active (editor) workspace ──────────────────────────────────

  const switchWorkspace = useCallback(
    (id: string) => {
      const store = useWorkspaceStore.getState();
      if (store.isDirty) {
        const confirm = window.confirm(
          t('workspace.unsavedChanges', 'You have unsaved changes. Discard?'),
        );
        if (!confirm) return;
      }
      store.setActiveWorkspaceId(id);
      store.setActiveFileHandle(null, null);
      store.setFileContent('');
      store.setIsDirty(false);
    },
    [t],
  );

  // ── Open a file from any workspace ────────────────────────────────────────

  const openFile = useCallback(
    async (node: import('../store/workspaceStore').FileNode) => {
      const store = useWorkspaceStore.getState();
      if (node.kind !== 'file') return;
      if (store.isDirty) {
        const confirm = window.confirm(
          t('workspace.unsavedChanges', 'You have unsaved changes. Discard?'),
        );
        if (!confirm) return;
      }
      try {
        store.setIsLoading(true);
        const ws = store.getActiveWorkspace();
        if (!ws) return;

        if (ws.type === 'server') {
          const { content } = await workflowsApi.readWorkspaceFile(node.path);
          store.setActiveFileHandle(null, node.path);
          store.setFileContent(content);
        } else {
          const fileHandle = node.handle as FileSystemFileHandle;
          const file = await fileHandle.getFile();
          const text = await file.text();
          store.setActiveFileHandle(fileHandle, node.path);
          store.setFileContent(text);
        }
        store.setIsDirty(false);
      } catch (error) {
        console.error('Error reading file:', error);
        toast.error(t('workspace.readError', 'Failed to read file'));
      } finally {
        store.setIsLoading(false);
      }
    },
    [t],
  );

  // ── Refresh the file tree for a workspace ─────────────────────────────────

  const refreshTree = useCallback(async (id?: string | null) => {
    const store = useWorkspaceStore.getState();
    const targetId = id ?? store.activeWorkspaceId;
    if (!targetId) return;
    const ws = store.getWorkspaceById(targetId);
    if (!ws) return;

    let newTree: FileNode | null = null;

    if (ws.type === 'server' && ws.nativePath) {
      newTree = await buildFileTreeServer(ws.nativePath);
    } else if (ws.rootHandle) {
      const children = await buildFileTree(ws.rootHandle);
      newTree = {
        name: ws.rootHandle.name,
        kind: 'directory',
        handle: ws.rootHandle,
        path: `/${ws.rootHandle.name}`,
        children,
      };
    }

    if (newTree) {
      store.updateWorkspaceTree(targetId, newTree);

      // Automatic Pruning: remove files from DB if they are no longer in the tree (e.g. deleted or gitignored)
      if (ws.nativePath) {
        const visiblePaths: string[] = [];
        const walk = (nodes: FileNode[]) => {
          for (const node of nodes) {
            if (node.kind === 'file') visiblePaths.push(node.path);
            if (node.children) walk(node.children);
          }
        };
        if (newTree.children) walk(newTree.children);
        if (newTree.kind === 'file') visiblePaths.push(newTree.path);

        // Non-blocking prune call
        fileIndexingApi.pruneWorkspace(ws.nativePath, visiblePaths).catch((err) => {
          console.error('Failed to auto-prune workspace:', err);
        });
      }
    }
  }, []);

  // ── Save the active file ──────────────────────────────────────────────────

  const saveFile = useCallback(async () => {
    const store = useWorkspaceStore.getState();
    const { activeFileHandle, fileContent, activeFilePath } = store;
    const ws = store.getActiveWorkspace();
    if (!ws || (!activeFileHandle && ws.type === 'local')) return;

    try {
      store.setIsLoading(true);
      if (ws.type === 'server') {
        if (!activeFilePath) return;
        await workflowsApi.writeWorkspaceFile(activeFilePath, fileContent);
      } else {
        const writable = await activeFileHandle!.createWritable();
        await writable.write(fileContent);
        await writable.close();
      }
      store.setIsDirty(false);
      toast.success(t('workspace.saved', 'File saved successfully'));

      // If saving .gitignore, trigger a refresh to prune newly ignored files immediately
      if (activeFilePath?.endsWith('.gitignore') || activeFileHandle?.name === '.gitignore') {
        refreshTree();
      }
    } catch (error) {
      console.error('Error saving file:', error);
      toast.error(t('workspace.saveError', 'Failed to save file'));
    } finally {
      store.setIsLoading(false);
    }
  }, [t, refreshTree]);

  // ── Create a file or folder ───────────────────────────────────────────────

  const createItem = useCallback(
    async (type: 'file' | 'directory', targetName: string, selectedPath?: string | null) => {
      const store = useWorkspaceStore.getState();
      const ws = store.getActiveWorkspace();
      if (!ws) return;
      try {
        store.setIsLoading(true);

        const activePath = selectedPath ?? store.activeFilePath;
        let isDir = false;

        if (activePath && ws.fileTree?.children) {
          const checkIsDir = (nodes: import('../store/workspaceStore').FileNode[]): boolean => {
            for (const node of nodes) {
              if (node.path === activePath) {
                isDir = node.kind === 'directory';
                return true;
              }
              if (node.children && checkIsDir(node.children)) return true;
            }
            return false;
          };
          checkIsDir(ws.fileTree.children);
        }

        if (ws.type === 'server') {
          const itemPath = activePath 
            ? (isDir ? `${activePath}/${targetName}` : `${dirname(activePath)}/${targetName}`)
            : `${ws.nativePath}/${targetName}`;
          
          await workflowsApi.createWorkspaceItem(itemPath, type);
          toast.success(t(`workspace.${type}Created`, `${type} created successfully`));
          
          const tree = await buildFileTreeServer(ws.nativePath!);
          store.updateWorkspaceTree(ws.id, tree);
        } else if (ws.rootHandle) {
          let dir = ws.rootHandle;
          if (activePath && activePath !== `/${ws.rootHandle.name}`) {
            const subPath = activePath.startsWith('/') ? activePath.slice(1) : activePath;
            const parts = subPath.split('/').filter(Boolean);

            if (!isDir && parts.length > 0) {
              parts.pop();
            }

            if (parts.length > 0) {
              dir = await resolveDirHandle(ws.rootHandle, parts, true);
            }
          }

          if (type === 'file') {
            await dir.getFileHandle(targetName, { create: true });
          } else {
            await dir.getDirectoryHandle(targetName, { create: true });
          }

          toast.success(t(`workspace.${type}Created`, `${type} created successfully`));
          const children = await buildFileTree(ws.rootHandle);
          store.updateWorkspaceTree(ws.id, {
            name: ws.rootHandle.name,
            kind: 'directory',
            handle: ws.rootHandle,
            path: `/${ws.rootHandle.name}`,
            children,
          });
        }
      } catch (error) {
        console.error(`Error creating ${type}:`, error);
        toast.error(t(`workspace.${type}CreateError`, `Failed to create ${type}`));
      } finally {
        store.setIsLoading(false);
      }
    },
    [t],
  );

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Turn terminal paths into an absolute string relative to the root workspace.
  // path can be '..', 'foo/bar', '/baz', etc.
  const resolveTerminalPath = useCallback((inputPath: string): string => {
    const store = useWorkspaceStore.getState();
    let base = store.currentTerminalPath || '';
    if (inputPath.startsWith('/')) {
      base = '';
      inputPath = inputPath.slice(1);
    }

    const parts = [...base.split('/'), ...inputPath.split('/')].filter(Boolean);
    const resolved: string[] = [];
    for (const p of parts) {
      if (p === '.') continue;
      if (p === '..') {
        resolved.pop();
      } else {
        resolved.push(p);
      }
    }
    return resolved.join('/');
  }, []);

  // ── Terminal command engine ───────────────────────────────────────────────

  const executeTerminalCommand = useCallback(
    async (raw: string): Promise<void> => {
      const store = useWorkspaceStore.getState();
      const targetId = store.terminalWorkspaceId ?? store.activeWorkspaceId;
      const ws = targetId ? store.getWorkspaceById(targetId) : null;
      const root = ws?.rootHandle ?? null;

      store.addTerminalEntry({ type: 'input', text: `$ ${raw}` });

      if (!root) {
        store.addTerminalEntry({ type: 'error', text: 'No workspace open. Open a folder first.' });
        return;
      }

      const line = raw.trim();
      if (!line) return;
      const [cmd, ...args] = line.split(/\s+/);

      try {
        if (cmd === 'pwd') {
          const currentPath = resolveTerminalPath('');
          const browserPath = `/${root.name}${currentPath ? '/' + currentPath : ''}`;
          const serverPath = ws?.nativePath
            ? `${ws.nativePath}${currentPath ? '/' + currentPath : ''}`
            : '(not mapped)';

          store.addTerminalEntry({
            type: 'output',
            text: `Browser: ${browserPath}\nServer : ${serverPath}`,
          });
        } else if (cmd === 'cd') {
          const target = args[0] || '';
          if (!target) {
            store.setCurrentTerminalPath('');
          } else {
            const potentialPath = resolveTerminalPath(target);
            // Verify path exists and is a directory
            try {
              if (potentialPath !== '') {
                await resolveDirHandle(root, potentialPath.split('/'));
              }
              store.setCurrentTerminalPath(potentialPath);
            } catch {
              throw new Error(`Directory not found: ${target}`);
            }
          }
        } else if (cmd === 'ls') {
          const target = args[0] || '.';
          const resolvedPath = resolveTerminalPath(target);
          const entries = await listDirAtPath(root, resolvedPath);
          store.addTerminalEntry({
            type: 'output',
            text:
              entries.length === 0
                ? '(empty)'
                : entries
                    .map((e) => (e.kind === 'directory' ? `📁  ${e.name}/` : `📄  ${e.name}`))
                    .join('\n'),
          });
        } else if (cmd === 'cat') {
          const targetPath = args[0];
          if (!targetPath) throw new Error('Usage: cat <path>');
          const content = await readFileAtPath(root, resolveTerminalPath(targetPath));
          store.addTerminalEntry({ type: 'output', text: content || '(empty file)' });
        } else if (cmd === 'mkdir') {
          const targetPath = args[0];
          if (!targetPath) throw new Error('Usage: mkdir <path>');
          const resolvedPath = resolveTerminalPath(targetPath);
          await createDirAtPath(root, resolvedPath);
          await refreshTree(targetId ?? undefined);
          store.addTerminalEntry({ type: 'output', text: `Directory created: ${resolvedPath}` });
        } else if (cmd === 'echo') {
          const raw2 = args.join(' ');
          const redirectIdx = raw2.lastIndexOf('>');
          if (redirectIdx !== -1) {
            const text = raw2
              .slice(0, redirectIdx)
              .trim()
              .replace(/^["']|["']$/g, '');
            const dest = raw2.slice(redirectIdx + 1).trim();
            if (!dest) throw new Error('Usage: echo "text" > <path>');
            const resolvedDest = resolveTerminalPath(dest);
            await writeFileAtPath(root, resolvedDest, text + '\n');
            await refreshTree(targetId ?? undefined);
            store.addTerminalEntry({ type: 'output', text: `Written to ${resolvedDest}` });
          } else {
            store.addTerminalEntry({ type: 'output', text: raw2.replace(/^["']|["']$/g, '') });
          }
        } else if (cmd === 'write') {
          const targetPath = args[0];
          const content = args
            .slice(1)
            .join(' ')
            .replace(/^["']|["']$/g, '');
          if (!targetPath) throw new Error('Usage: write <path> <content>');
          const resolvedPath = resolveTerminalPath(targetPath);
          await writeFileAtPath(root, resolvedPath, content + '\n');
          await refreshTree(targetId ?? undefined);
          store.addTerminalEntry({ type: 'output', text: `Written to ${resolvedPath}` });
        } else if (cmd === 'clear') {
          store.clearTerminal();
        } else if (cmd === 'help') {
          store.addTerminalEntry({
            type: 'info',
            text: [
              'Available commands:',
              '  pwd                      — print current path',
              '  cd [path]                — change directory',
              '  ls [path]                — list directory',
              '  cat <path>               — read file contents',
              '  mkdir <path>             — create directory',
              '  echo "text" > <path>     — write text to file',
              '  write <path> <content>   — write content to file',
              '  clear                    — clear terminal',
              '  help                     — show this help',
            ].join('\n'),
          });
        } else {
          // If unrecognized, try to run it on the server (shell_execute tool)
          if (ws?.nativePath) {
            try {
              store.addTerminalEntry({
                type: 'info',
                text: `Running on server in ${ws.nativePath}...`,
              });
              const result = await workflowsApi.testNode('temp-workflow-id', 'temp-node-id', {
                type: 'SHELL',
                config: { command: line, cwd: ws.nativePath },
              });

              if (result.logs) {
                result.logs.forEach((l) => {
                  if (l.includes('[STDOUT]') || l.includes('[STDERR]')) {
                    store.addTerminalEntry({
                      type: 'output',
                      text: l.replace(/\[(STDOUT|STDERR)\]\s*/, ''),
                    });
                  }
                });
              }

              if (result.error) {
                store.addTerminalEntry({ type: 'error', text: `Failed: ${result.error}` });
              }
            } catch (err: unknown) {
              store.addTerminalEntry({
                type: 'error',
                text: `Server shell error: ${err instanceof Error ? err.message : String(err)}`,
              });
            }
          } else {
            store.addTerminalEntry({
              type: 'error',
              text: `Unknown command: "${cmd}". No server path set for this workspace.`,
            });
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        store.addTerminalEntry({ type: 'error', text: `Error: ${msg}` });
      }
    },
    [refreshTree, resolveTerminalPath],
  );

  // ── Derived helpers ───────────────────────────────────────────────────────

  return {
    openWorkspace,
    openRecentWorkspace,
    loadPersistedWorkspaces,
    requestWorkspacePermission,
    ensureWorkspacePermission,
    openFile,
    saveFile,
    closeWorkspace,
    switchWorkspace,
    refreshTree,
    createItem,
    executeTerminalCommand,
  };
};
