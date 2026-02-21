'use client';

import { useTranslation } from 'react-i18next';
import { UseCaseItem } from './UseCaseItem';

export function LandingUseCases() {
  const { t } = useTranslation();

  const useCases = [
    {
      titleKey: 'RAG Systems',
      descriptionKey:
        'Build Retrieval-Augmented Generation pipelines that ingest docs and answer queries with citations.',
    },
    {
      titleKey: 'Autonomous Research',
      descriptionKey:
        'Deploy agents that browse the web, scrape data, summarize findings, and generate reports automatically.',
    },
    {
      titleKey: 'DevOps Automation',
      descriptionKey:
        'Create agents that monitor logs, diagnose issues, and even trigger remediation scripts safely.',
    },
  ];

  const logLines = [
    { color: 'text-green-400', text: '> Agent "ResearchBot" started' },
    { color: 'text-blue-400', text: '> Searching for "Deep learning trends 2026"' },
    { color: 'text-purple-400', text: '> Found 14 sources. Analyzing...' },
    { color: 'text-muted-foreground', text: '> Summarizing key points...' },
    { color: 'text-green-400', text: '> Report generated successfully.' },
  ];

  return (
    <section className="py-24 border-t border-border/50 transition-colors">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-6 text-foreground">
              {t('Built for scale & complexity')}
            </h2>
            <div className="space-y-8">
              {useCases.map((uc) => (
                <UseCaseItem
                  key={uc.titleKey}
                  title={t(uc.titleKey)}
                  description={t(uc.descriptionKey)}
                />
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />
            <div className="relative bg-card border border-border/50 rounded-xl p-6 shadow-2xl transition-colors">
              <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-4">
                <span className="text-sm font-mono text-muted-foreground">
                  {t('Execution Log')}
                </span>
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                </div>
              </div>
              <div className="space-y-3 font-mono text-xs md:text-sm">
                {logLines.map((line, i) => (
                  <div key={i} className={line.color}>
                    {line.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
