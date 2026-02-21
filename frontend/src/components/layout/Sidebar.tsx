'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Workflow,
  Bot,
  Wrench,
  Layers,
  PlayCircle,
  Sun,
  Moon,
  Languages,
  LogOut,
  User,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Workflows', href: '/workflows', icon: Workflow },
  { name: 'Agents', href: '/agents', icon: Bot },
  { name: 'Tools', href: '/tools', icon: Wrench },
  { name: 'Models', href: '/models', icon: Layers },
  { name: 'Executions', href: '/executions', icon: PlayCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user;

  // Mounted state for theme hydration issues
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'en' ? 'fr' : 'en';
    i18n.changeLanguage(nextLang);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r border-border/50 text-foreground transition-all duration-300 shadow-sm z-20">
      <div className="flex h-16 items-center px-6 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-1.5 rounded-lg border border-primary/20">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-foreground to-foreground/70">
            {t('Multi-Agent')}
          </h1>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                )}
              />
              {t(item.name)}
            </Link>
          );
        })}
      </nav>

      {/* Footer Section */}
      <div className="p-4 border-t border-border/50 space-y-4">
        {/* Utilities: Lang & Theme */}
        <div className="flex items-center justify-between px-2">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            title="Toggle Language"
          >
            <Languages className="h-4 w-4" />
            <span className="uppercase text-xs font-semibold">
              {mounted ? i18n.language : 'EN'}
            </span>
          </button>

          <button
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-foreground transition-all hover:rotate-12"
            title="Toggle Theme"
          >
            {mounted && theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* User Info & Logout */}
        {user ? (
          <div className="flex items-center justify-between rounded-xl bg-muted/40 border border-border/50 p-2.5 shadow-sm">
            <div className="flex items-center gap-2 overflow-hidden text-sm">
              <div className="bg-background shadow-sm border border-border/50 p-1.5 rounded-full shrink-0 text-primary">
                <User className="h-4 w-4" />
              </div>
              <span className="truncate max-w-[110px] font-medium text-foreground/90">
                {user.name || user.email}
              </span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors shrink-0 p-1.5"
              title={t('Logout')}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
