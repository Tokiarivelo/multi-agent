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
      const sessionUser = session.user;
      const sessionId = sessionUser.id || '';

      // Only update if the user data has meaningfully changed
      if (user?.id !== sessionId) {
        setUser({
          id: sessionId,
          email: sessionUser.email || '',
          name: sessionUser.name || '',
          image: sessionUser.image || undefined,
          role: sessionUser.role,
          createdAt: user?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } else if (status === 'unauthenticated' && isAuthenticated) {
      logout();
    }
  }, [session, status, user?.id, user?.createdAt, isAuthenticated, setUser, logout]);

  // Provide instantaneous synchronized value when session is ready
  if (status === 'authenticated' && session?.user) {
    const sessionUser = session.user;
    return {
      user: {
        id: sessionUser.id || '',
        email: sessionUser.email || '',
        name: sessionUser.name || '',
        image: sessionUser.image || undefined,
        role: sessionUser.role,
        createdAt: user?.createdAt || new Date().toISOString(),
        updatedAt: user?.updatedAt || new Date().toISOString(),
      },
      isAuthenticated: true,
      setUser,
      logout,
    };
  }

  return { user, isAuthenticated, setUser, logout };
};

