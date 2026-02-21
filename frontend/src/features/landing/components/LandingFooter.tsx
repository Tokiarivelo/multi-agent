'use client';

import { useTranslation } from 'react-i18next';

export function LandingFooter() {
  const { t } = useTranslation();

  return (
    <footer className="py-12 border-t border-border/50 bg-background text-center transition-colors">
      <p className="text-muted-foreground text-sm">
        © {new Date().getFullYear()}{' '}
        {t('Multi-Agent Architecture. Built with NestJS, Next.js, and NATS.')}
      </p>
    </footer>
  );
}
