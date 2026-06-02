'use client';

import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { TemplateCard } from './TemplateCard';
import { TemplateListItem } from '../types/marketplace.types';

interface TemplateGridProps {
  templates: TemplateListItem[];
  isLoading: boolean;
  onPreview: (template: TemplateListItem) => void;
  onInstall: (templateId: string) => void;
  isInstalling: boolean;
}

function TemplateSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
        <div className="h-3 w-full rounded bg-muted animate-pulse" />
        <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
        <div className="flex gap-1 pt-1">
          <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
          <div className="h-5 w-12 rounded-full bg-muted animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

export function TemplateGrid({
  templates,
  isLoading,
  onPreview,
  onInstall,
  isInstalling,
}: TemplateGridProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <TemplateSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">{t('marketplace.empty')}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          onPreview={onPreview}
          onInstall={onInstall}
          isInstalling={isInstalling}
        />
      ))}
    </div>
  );
}
