import { create } from 'zustand';
import { User } from '@/types';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStoreBase = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));

export const useAuthStore = () => {
  const user = useAuthStoreBase((s) => s.user);
  const isAuthenticated = useAuthStoreBase((s) => s.isAuthenticated);
  const setUser = useAuthStoreBase((s) => s.setUser);
  const logout = useAuthStoreBase((s) => s.logout);

  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const sessionId =
        session.user.id || ((session as unknown) as { user?: { id?: string } })?.user?.id || '';

      // Only update if the user ID has changed to prevent infinite loops
      if (user?.id !== sessionId) {
        setUser({
          id: sessionId,
          email: session.user.email || '',
          name: session.user.name || '',
          createdAt: user?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as User);
      }
    } else if (status === 'unauthenticated' && isAuthenticated) {
      logout();
    }
  }, [session, status, user?.id, user?.createdAt, isAuthenticated, setUser, logout]);

  // Provide instantaneous synchronized value whenever session is ready
  if (status === 'authenticated' && session?.user) {
    const sessionId =
      session.user.id || ((session as unknown) as { user?: { id?: string } })?.user?.id || '';
    return {
      user: {
        id: sessionId,
        email: session.user.email || '',
        name: session.user.name || '',
        createdAt: user?.createdAt || new Date().toISOString(),
        updatedAt: user?.updatedAt || new Date().toISOString(),
      } as User,
      isAuthenticated: true,
      setUser,
      logout,
    };
  }

  return { user, isAuthenticated, setUser, logout };
};
