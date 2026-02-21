'use client';

import { useTranslation } from 'react-i18next';

interface DocSectionProps {
  titleKey: string;
  children: React.ReactNode;
}

export function DocSection({ titleKey, children }: DocSectionProps) {
  const { t } = useTranslation();

  return (
    <section className="mb-16">
      <h2 className="text-2xl font-semibold mb-6 text-primary">{t(titleKey)}</h2>
      {children}
    </section>
  );
}
