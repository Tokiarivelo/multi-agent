'use client';

import { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { CategoryFilter } from '@/features/marketplace/components/CategoryFilter';
import { FeaturedBanner } from '@/features/marketplace/components/FeaturedBanner';
import { TemplateGrid } from '@/features/marketplace/components/TemplateGrid';
import { TemplateDetailModal } from '@/features/marketplace/components/TemplateDetailModal';
import { useMarketplaceCategories, useMarketplaceTemplates } from '@/features/marketplace/hooks/useMarketplace';
import { useInstallTemplate } from '@/features/marketplace/hooks/useInstallTemplate';
import { TemplateListItem } from '@/features/marketplace/types/marketplace.types';

function MarketplaceContent() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<TemplateListItem | null>(null);

  const { data, isLoading } = useMarketplaceTemplates({
    category: category ?? undefined,
    search: search || undefined,
    page: 1,
    limit: 20,
  });
  const { data: categories = [] } = useMarketplaceCategories();
  const install = useInstallTemplate();

  const templates = data?.data ?? [];
  const featured = !category && !search ? templates.filter((tpl) => tpl.isFeatured) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('marketplace.title')}</h1>
        <p className="text-muted-foreground">{t('marketplace.subtitle')}</p>
      </div>

      <FeaturedBanner
        templates={featured}
        onPreview={setPreview}
        onInstall={(id) => install.mutate(id)}
        isInstalling={install.isPending}
      />

      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t('marketplace.search.placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <CategoryFilter categories={categories} selected={category} onChange={setCategory} />
      </div>

      <TemplateGrid
        templates={templates}
        isLoading={isLoading}
        onPreview={setPreview}
        onInstall={(id) => install.mutate(id)}
        isInstalling={install.isPending}
      />

      <TemplateDetailModal
        template={preview}
        open={!!preview}
        onOpenChange={(open) => { if (!open) setPreview(null); }}
        onInstall={(id) => install.mutate(id)}
        isInstalling={install.isPending}
      />
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={null}>
      <MarketplaceContent />
    </Suspense>
  );
}
