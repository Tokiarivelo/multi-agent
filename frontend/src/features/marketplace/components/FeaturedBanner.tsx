'use client';

import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Star } from 'lucide-react';
import { TemplateListItem } from '../types/marketplace.types';

interface FeaturedBannerProps {
  templates: TemplateListItem[];
  onPreview: (template: TemplateListItem) => void;
  onInstall: (templateId: string) => void;
  isInstalling: boolean;
}

export function FeaturedBanner({
  templates,
  onPreview,
  onInstall,
  isInstalling,
}: FeaturedBannerProps) {
  const { t } = useTranslation();

  if (templates.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
        <h2 className="text-sm font-semibold">{t('marketplace.featured')}</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {templates.map((template) => (
          <div
            key={template.id}
            className="flex-shrink-0 w-64 rounded-xl border bg-card p-4 space-y-2 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-sm truncate flex-1">{template.name}</p>
              {template.category && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {template.category}
                </Badge>
              )}
            </div>
            {template.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {template.description}
              </p>
            )}
            <div className="flex gap-1.5 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={() => onPreview(template)}
              >
                {t('marketplace.card.preview')}
              </Button>
              <Button
                size="sm"
                className="h-7 gap-1 text-xs flex-1"
                disabled={isInstalling}
                onClick={() => onInstall(template.id)}
              >
                <Download className="h-3 w-3" />
                {t('marketplace.card.install')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
