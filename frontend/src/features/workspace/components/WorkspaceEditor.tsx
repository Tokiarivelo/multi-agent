import React from 'react';
import Editor from '@monaco-editor/react';
import { FileCode, Loader2, DatabaseZap, CheckCircle2, AlertCircle, RefreshCw, Save } from 'lucide-react';
import { useWorkspaceEditorLogic } from '../hooks/useWorkspaceEditor';
import { useFileStatus } from '../hooks/useFileStatus';
import { useWorkspaceSidebar } from '../hooks/useWorkspaceSidebar';
import { useWorkspaceStore } from '../store/workspaceStore';
import { Button } from '@/components/ui/button';

export function WorkspaceEditor() {
  const {
    theme,
    activeFilePath,
    activeFileNode,
    fileContent,
    t,
    getLanguage,
    handleChange,
    handleEditorMount,
    saveFile,
  } = useWorkspaceEditorLogic();

  const activeWorkspace = useWorkspaceStore((s) => s.getActiveWorkspace());
  const { status, isModified, isIndexable } = useFileStatus(activeFileNode);
  const { uploadAndIndex } = useWorkspaceSidebar(activeWorkspace);

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

  const renderIndexStatus = () => {
    if (!isIndexable) return null;

    if (status === 'indexing') {
      return (
        <div className="flex items-center gap-1.5 text-xs text-violet-400 font-medium bg-violet-400/10 px-2 py-1 rounded-full animate-pulse">
          <Loader2 className="h-3 w-3 animate-spin" />
          Indexing...
        </div>
      );
    }

    if (status === 'indexed') {
      return (
        <div className="flex items-center gap-2">
          {isModified ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => activeFileNode && uploadAndIndex(activeFileNode)}
              className="h-7 gap-1.5 text-xs border-amber-500/50 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
            >
              <RefreshCw className="h-3 w-3" />
              Update Index
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-400/10 px-2 py-1 rounded-full">
              <CheckCircle2 className="h-3 w-3" />
              Indexed
            </div>
          )}
        </div>
      );
    }

    if (status === 'error') {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => activeFileNode && uploadAndIndex(activeFileNode)}
          className="h-7 gap-1.5 text-xs border-red-500/50 text-red-500 hover:bg-red-500/10"
        >
          <AlertCircle className="h-3 w-3" />
          Retry Indexing
        </Button>
      );
    }

    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => activeFileNode && uploadAndIndex(activeFileNode)}
        className="h-7 gap-1.5 text-xs border-violet-500/50 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300"
      >
        <DatabaseZap className="h-3 w-3" />
        Index File
      </Button>
    );
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full relative overflow-hidden bg-background">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 backdrop-blur-sm z-10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 rounded bg-foreground/5 shrink-0">
            <FileCode className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate leading-none mb-1">
              {activeFilePath.split('/').pop()}
            </span>
            <span className="text-[10px] text-muted-foreground truncate leading-none opacity-60">
              {activeFilePath}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {renderIndexStatus()}
          <div className="w-px h-4 bg-border" />
          <Button
            variant="ghost"
            size="sm"
            onClick={saveFile}
            className="h-8 gap-2 text-xs hover:bg-muted"
            title="Save changes (Ctrl+S)"
          >
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Save</span>
          </Button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 w-full relative">
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
            lineNumbersMinChars: 3,
            glyphMargin: false,
            folding: true,
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible',
            },
          }}
          loading={
            <div className="flex h-full items-center justify-center text-muted-foreground w-full">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              {t('workspace.loadingEditor', 'Loading editor...')}
            </div>
          }
        />
      </div>
    </div>
  );
}
