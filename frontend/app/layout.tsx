'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './globals.css';
import '@/lib/i18n';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ThemeProvider } from '@/components/shared/ThemeProvider';

import { SessionProvider } from 'next-auth/react';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Multi-Agent Platform</title>
        <meta name="description" content="Multi-agent workflow orchestration platform" />
      </head>
      <body className="antialiased bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider>
            <ErrorBoundary>
              <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            </ErrorBoundary>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
