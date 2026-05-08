import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NodePreferencesState {
  disabledNodeTypes: string[];
  deletedNodeTypes: string[];
  toggleDisable: (id: string) => void;
  deleteNodeType: (id: string) => void;
  restoreNodeType: (id: string) => void;
  isAvailable: (id: string) => boolean;
}

export const useNodePreferencesStore = create<NodePreferencesState>()(
  persist(
    (set, get) => ({
      disabledNodeTypes: [],
      deletedNodeTypes: [],

      toggleDisable: (id) =>
        set((s) => ({
          disabledNodeTypes: s.disabledNodeTypes.includes(id)
            ? s.disabledNodeTypes.filter((x) => x !== id)
            : [...s.disabledNodeTypes, id],
        })),

      deleteNodeType: (id) =>
        set((s) => ({
          deletedNodeTypes: s.deletedNodeTypes.includes(id)
            ? s.deletedNodeTypes
            : [...s.deletedNodeTypes, id],
          disabledNodeTypes: s.disabledNodeTypes.filter((x) => x !== id),
        })),

      restoreNodeType: (id) =>
        set((s) => ({
          deletedNodeTypes: s.deletedNodeTypes.filter((x) => x !== id),
        })),

      isAvailable: (id) => {
        const { disabledNodeTypes, deletedNodeTypes } = get();
        return !disabledNodeTypes.includes(id) && !deletedNodeTypes.includes(id);
      },
    }),
    { name: 'node-preferences' },
  ),
);
