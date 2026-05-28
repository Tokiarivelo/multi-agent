import { create } from 'zustand';

interface RoleErrorState {
  message: string | null;
  setError: (message: string) => void;
  clear: () => void;
}

export const useRoleErrorStore = create<RoleErrorState>((set) => ({
  message: null,
  setError: (message) => set({ message }),
  clear: () => set({ message: null }),
}));
