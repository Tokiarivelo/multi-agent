'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { AuthMenu } from '@/components/shared/AuthMenu';

export function LandingNavbar() {
  const { t } = useTranslation();

  return (
    <nav className="fixed w-full z-50 bg-background/50 backdrop-blur-md border-b border-border/50 transition-colors">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tighter text-foreground">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground text-lg">M</span>
          </div>
          {t('Multi-Agent')}
        </div>
        <div className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">
            {t('Features')}
          </a>
          <Link href="/docs" className="hover:text-foreground transition-colors">
            {t('Documentation')}
          </Link>
          <AuthMenu />
        </div>
      </div>
    </nav>
  );
}
