import { useRef, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useWorkspaceStore, type FileNode } from '../store/workspaceStore';
import { useWorkspace } from '../hooks/useWorkspace';
import { useTranslation } from 'react-i18next';

export function useWorkspaceEditorLogic() {
  const { theme } = useTheme();
  const activeFilePath = useWorkspaceStore((s) => s.activeFilePath);
  const fileContent = useWorkspaceStore((s) => s.fileContent);
  const setFileContent = useWorkspaceStore((s) => s.setFileContent);
  const setIsDirty = useWorkspaceStore((s) => s.setIsDirty);
  const { t } = useTranslation('common');
  const { saveFile } = useWorkspace();

  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const getLanguage = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'json':
        return 'json';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'md':
        return 'markdown';
      case 'py':
        return 'python';
      default:
        return 'plaintext';
    }
  };

  const handleChange = (value: string | undefined) => {
    if (value !== undefined) {
      if (!useWorkspaceStore.getState().isDirty) {
        setIsDirty(true);
      }

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setFileContent(value);
      }, 250);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditorMount = (editorInstance: any, monaco: any) => {
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveFile();
    });
  };

  const findNodeByPath = (nodes: FileNode[], path: string): FileNode | null => {
    for (const node of nodes) {
      if (node.path === path) return node;
      if (node.children) {
        const found = findNodeByPath(node.children, path);
        if (found) return found;
      }
    }
    return null;
  };

  const activeWorkspace = useWorkspaceStore((s) => s.getActiveWorkspace());
  const activeFileNode = activeFilePath && activeWorkspace?.fileTree 
    ? findNodeByPath([activeWorkspace.fileTree], activeFilePath) 
    : null;

  return {
    theme,
    activeFilePath,
    activeFileNode,
    fileContent,
    t,
    getLanguage,
    handleChange,
    handleEditorMount,
    saveFile,
  };
}
