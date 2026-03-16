'use client';

import React, { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from 'next-themes';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useWorkspace } from '../hooks/useWorkspace';
import { useTranslation } from 'react-i18next';
import { FileCode, Loader2 } from 'lucide-react';

export function WorkspaceEditor() {
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

  if (!activeFilePath) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-muted-foreground w-full">
        <FileCode className="h-16 w-16 opacity-20 mb-4" />
        <p className="text-lg font-medium">{t('workspace.noFileSelected', 'No file selected')}</p>
        <p className="text-sm opacity-70 mt-2">
          {t(
            'workspace.selectFileDesc',
            'Select a file from the sidebar to view or edit its contents.',
          )}
        </p>
      </div>
    );
  }

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

  return (
    <div className="flex-1 w-full h-full relative">
      <Editor
        height="100%"
        width="100%"
        language={getLanguage(activeFilePath)}
        theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
        value={fileContent}
        onChange={handleChange}
        onMount={handleEditorMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          padding: { top: 16 },
        }}
        loading={
          <div className="flex h-full items-center justify-center text-muted-foreground w-full">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            {t('workspace.loadingEditor', 'Loading editor...')}
          </div>
        }
      />
    </div>
  );
}
