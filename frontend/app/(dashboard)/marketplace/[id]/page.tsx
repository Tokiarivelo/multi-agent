'use client';

import { use } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { ArrowLeft, Download, Loader2, Network } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useMarketplaceTemplate } from '@/features/marketplace/hooks/useMarketplace';
import { useInstallTemplate } from '@/features/marketplace/hooks/useInstallTemplate';

export default function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslation();
  const { data: template, isLoading } = useMarketplaceTemplate(id);
  const install = useInstallTemplate();

  if (isLoading) {
    return (
      <div className="flex justify-center pt-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="text-center pt-20 text-muted-foreground">
        {t('marketplace.notFound')}
      </div>
    );
  }

  const nodeCount = Array.isArray(template.nodes) ? (template.nodes as unknown[]).length : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('marketplace.backTo')}
      </Link>

      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold flex-1">{template.name}</h1>
          {template.category && <Badge>{template.category}</Badge>}
        </div>
        {template.authorName && (
          <p className="text-sm text-muted-foreground">
            {t('marketplace.card.by', { author: template.authorName })}
          </p>
        )}
      </div>

      {template.description && (
        <p className="text-muted-foreground">{template.description}</p>
      )}

      <div className="flex gap-6 text-sm text-muted-foreground border-y py-4">
        <span className="flex items-center gap-1.5">
          <Network className="h-4 w-4" />
          {t('marketplace.detail.nodes', { count: nodeCount })}
        </span>
        <span>{t('marketplace.card.installs', { count: template.installsCount })}</span>
      </div>

      {template.tags.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('marketplace.detail.tags')}</p>
          <div className="flex flex-wrap gap-1">
            {template.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Button
        size="lg"
        className="gap-2"
        disabled={install.isPending}
        onClick={() => install.mutate(id)}
      >
        {install.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('marketplace.install.loading')}
          </>
        ) : (
          <>
            <Download className="h-5 w-5" />
            {t('marketplace.card.install')}
          </>
        )}
      </Button>
    </div>
  );
}
