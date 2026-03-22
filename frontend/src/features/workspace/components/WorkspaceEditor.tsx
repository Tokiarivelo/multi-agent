'use client';

import React from 'react';
import Editor from '@monaco-editor/react';
import { FileCode, Loader2 } from 'lucide-react';
import { useWorkspaceEditorLogic } from '../hooks/useWorkspaceEditor';

export function WorkspaceEditor() {
  const {
    theme,
    activeFilePath,
    fileContent,
    t,
    getLanguage,
    handleChange,
    handleEditorMount,
  } = useWorkspaceEditorLogic();

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
