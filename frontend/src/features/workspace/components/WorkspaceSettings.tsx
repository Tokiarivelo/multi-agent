import { Loader2, Plus, Settings, X } from 'lucide-react';
import React from 'react';
import { useWorkspaceSettings } from '../hooks/useWorkspaceSettings';

interface WorkspaceSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WorkspaceSettings: React.FC<WorkspaceSettingsProps> = ({ isOpen, onClose }) => {
  const {
    extensions,
    isLoading,
    newExtension,
    setNewExtension,
    handleAddExtension,
    handleRemoveExtension,
    isPending,
  } = useWorkspaceSettings(isOpen);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md overflow-hidden bg-white/10 dark:bg-zinc-900/50 border border-white/20 dark:border-zinc-800/50 rounded-2xl shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 dark:border-zinc-800/50 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold bg-linear-to-br from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
              Workspace Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 opacity-70" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <section className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-zinc-300">Indexable Extensions</h3>
              <p className="text-xs text-zinc-500">
                Define which file types should be scanned and indexed for semantic search.
              </p>
            </div>

            {/* Add extension form */}
            <form onSubmit={handleAddExtension} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={newExtension}
                  onChange={(e) => setNewExtension(e.target.value)}
                  placeholder="e.g. log, py, rs"
                  className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">Add</span>
              </button>
            </form>

            {/* Extension List */}
            <div className="flex flex-wrap gap-2 pt-2">
              {isLoading ? (
                <div className="w-full py-8 flex items-center justify-center opacity-50">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                extensions.map((ext) => (
                  <div
                    key={ext}
                    className="group flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full hover:border-primary/50 hover:bg-primary/5 transition-all animate-in fade-in slide-in-from-top-1"
                  >
                    <span className="text-xs font-medium opacity-80">{ext}</span>
                    <button
                      onClick={() => handleRemoveExtension(ext)}
                      className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-full transition-all"
                    >
                      <X className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 bg-white/5 border-t border-white/10 dark:border-zinc-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all shadow-xl"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
