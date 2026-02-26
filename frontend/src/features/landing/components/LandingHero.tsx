'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function LandingHero() {
  const { t } = useTranslation();

  return (
    <section className="relative pt-32 pb-24 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wide mb-6">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          {t('v1.0 Now Available')}
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 bg-linear-to-b from-foreground to-muted-foreground bg-clip-text text-transparent transition-colors">
          {t('Orchestrate AI Agents')} <br /> {t('Like Never Before.')}
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed transition-colors">
          {t(
            'A powerful microservice architecture for building, deploying, and managing autonomous AI agents. Scale your workflows with heavy-duty tools, vector memory, and real-time event monitoring.',
          )}
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-all hover:scale-105 flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            {t('Launch Dashboard')} <ChevronRight className="w-4 h-4" />
          </Link>
          <Link
            href="/docs"
            className="px-8 py-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border/50 rounded-lg font-semibold transition-all shadow-sm"
          >
            {t('Read Docs')}
          </Link>
        </div>
      </div>
    </section>
  );
}
