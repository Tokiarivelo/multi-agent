'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { LogOut, User, LayoutDashboard, ChevronDown, Moon, Sun, Languages } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export function AuthMenu() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const { theme, setTheme } = useTheme();
  const { i18n, t } = useTranslation();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'en' ? 'fr' : 'en';
    i18n.changeLanguage(nextLang);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // Give a stable skeleton for unmounted theme layout
  if (status === 'loading' || !mounted) {
    return <div className="h-10 w-24 bg-muted/50 animate-pulse rounded-full" />;
  }

  // Render "Get Started" when not authenticated
  if (!session?.user) {
    return (
      <Link
        href="/register"
        className="px-6 py-2.5 bg-linear-to-r from-primary to-indigo-600 text-primary-foreground rounded-full hover:from-primary/90 hover:to-indigo-500 transition-all font-medium shadow-lg shadow-primary/20"
      >
        {t('Get Started')}
      </Link>
    );
  }

  // Render a Dropdown Menu when authenticated
  const user = session.user;
  return (
    <div className="relative z-50 inline-block text-left" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-card border border-border/50 rounded-full hover:bg-muted/50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        <div className="bg-primary/10 text-primary p-1 rounded-full">
          <User className="w-4 h-4" />
        </div>
        <span className="text-sm font-medium text-foreground max-w-[100px] truncate">
          {user.name || user.email?.split('@')[0]}
        </span>
        <ChevronDown
          className={cn('w-4 h-4 text-muted-foreground transition-transform', {
            'rotate-180': isOpen,
          })}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-card border border-border/50 shadow-xl overflow-hidden focus:outline-none origin-top-right animate-in fade-in zoom-in-95 duration-200">
          <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
            <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>

          <div className="py-2">
            <Link
              href="/dashboard"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
              {t('Dashboard')}
            </Link>
          </div>

          <div className="border-t border-border/50 py-2">
            <button
              onClick={toggleLanguage}
              className="w-full flex items-center justify-between px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-muted-foreground" />
                {t('Language')}
              </div>
              <span className="text-xs font-semibold uppercase text-muted-foreground bg-muted-foreground/10 px-2 py-0.5 rounded">
                {i18n.language || 'EN'}
              </span>
            </button>
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-between px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2">
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Moon className="w-4 h-4 text-muted-foreground" />
                )}
                {t('Theme')}
              </div>
              <span className="text-xs capitalize text-muted-foreground">{theme}</span>
            </button>
          </div>

          <div className="border-t border-border/50 py-2">
            <button
              onClick={() => {
                setIsOpen(false);
                signOut({ callbackUrl: '/login' });
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {t('Log out')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
