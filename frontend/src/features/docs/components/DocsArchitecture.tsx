'use client';

import { useTranslation } from 'react-i18next';

export function DocsArchitecture() {
  const { t } = useTranslation();

  return (
    <div>
      <p className="mb-4 leading-relaxed text-muted-foreground">
        {t('docs.architecture.description')}
      </p>
      <div className="bg-muted/30 dark:bg-muted/20 p-6 rounded-xl border border-border/50 font-mono text-xs text-foreground/80 whitespace-pre overflow-x-auto">
        {`[Frontend] <--> [Gateway Service] <--> [NATS Bus]
                       |
            +----------+----------+
            |          |          |
      [Agent Svc] [Orch Svc] [Tool Svc] ...`}
      </div>
    </div>
  );
}
