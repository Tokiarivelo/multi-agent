'use client';

import { useTranslation } from 'react-i18next';
import { PublishedWorkflowsList } from '@/features/marketplace/components/PublishedWorkflowsList';
import Link from 'next/link';
import { Store } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PublishedWorkflowsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('marketplace.myPublished.title')}</h1>
          <p className="text-muted-foreground">{t('marketplace.myPublished.subtitle')}</p>
        </div>
        <Link href="/marketplace">
          <Button variant="outline" className="gap-2">
            <Store className="h-4 w-4" />
            {t('marketplace.title')}
          </Button>
        </Link>
      </div>

      <PublishedWorkflowsList />
    </div>
  );
}
