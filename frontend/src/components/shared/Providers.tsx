'use client';

import { useEffect, useState } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import { Session } from 'next-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/shared/ThemeProvider';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Toaster } from '@/components/ui/sonner';
import { setApiToken } from '@/lib/api-client';
import '@/lib/i18n';

/**
 * Synchronizes the NextAuth session token with our axios api-client.
 */
function TokenSync() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[TokenSync] Synchronizing accessToken to ApiClient');
      }
      setApiToken(session.accessToken);
    } else if (status === 'unauthenticated') {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[TokenSync] Clearing ApiClient token (unauthenticated)');
      }
      setApiToken(null);
    }
  }, [session, status]);

  return null;
}

interface ProvidersProps {
  children: React.ReactNode;
  session: Session | null;
}

export default function Providers({ children, session }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <SessionProvider session={session}>
      <TokenSync />
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </ErrorBoundary>
        <Toaster position="top-right" richColors />
      </ThemeProvider>
    </SessionProvider>
  );
}
