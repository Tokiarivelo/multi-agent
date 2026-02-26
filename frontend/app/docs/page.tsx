'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LandingNavbar } from '@/features/landing';
import { DocSection, DocsArchitecture, DocsCoreServices } from '@/features/docs';

export default function DocsPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans transition-colors">
      <LandingNavbar />

      <div className="max-w-4xl mx-auto px-6 pt-28 pb-24">
        <h1 className="text-4xl font-bold text-foreground mb-2">{t('Documentation')}</h1>
        <p className="text-muted-foreground mb-12 border-b border-border/50 pb-8">
          {t('docs.subtitle')}
        </p>

        <DocSection titleKey="docs.architecture.title">
          <DocsArchitecture />
        </DocSection>

        <DocSection titleKey="Core Services">
          <DocsCoreServices />
        </DocSection>

        <DocSection titleKey="docs.auth.title">
          <p className="leading-relaxed text-muted-foreground">{t('docs.auth.description')}</p>
        </DocSection>

        <DocSection titleKey="docs.events.title">
          <p className="leading-relaxed text-muted-foreground">{t('docs.events.description')}</p>
        </DocSection>

        <div className="mt-12 pt-8 border-t border-border/50">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('docs.backToHome')}
          </Link>
        </div>
      </div>
    </div>
  );
}
