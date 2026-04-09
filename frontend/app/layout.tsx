import './globals.css';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import Providers from '@/components/shared/Providers';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Multi-Agent Platform</title>
        <meta name="description" content="Multi-agent workflow orchestration platform" />
      </head>
      <body className="antialiased bg-background text-foreground">
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
