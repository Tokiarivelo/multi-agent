'use client';

import { useTranslation } from 'react-i18next';
import { DocServiceCard } from './DocServiceCard';

export function DocsCoreServices() {
  const { t } = useTranslation();

  const services = [
    {
      titleKey: 'Agent Service',
      descKey: 'docs.services.agent',
    },
    {
      titleKey: 'docs.services.orchestration.title',
      descKey: 'docs.services.orchestration',
    },
    {
      titleKey: 'Tool Service',
      descKey: 'docs.services.tool',
    },
    {
      titleKey: 'docs.services.vector.title',
      descKey: 'docs.services.vector',
    },
    {
      titleKey: 'docs.services.model.title',
      descKey: 'docs.services.model',
    },
  ];

  return (
    <div className="space-y-4">
      {services.map((svc) => (
        <DocServiceCard key={svc.titleKey} title={t(svc.titleKey)} description={t(svc.descKey)} />
      ))}
    </div>
  );
}
