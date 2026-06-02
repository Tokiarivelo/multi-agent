'use client';

import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Download, Eye, Star } from 'lucide-react';
import { TemplateListItem } from '../types/marketplace.types';

interface TemplateCardProps {
  template: TemplateListItem;
  onPreview: (template: TemplateListItem) => void;
  onInstall: (templateId: string) => void;
  isInstalling: boolean;
}

export function TemplateCard({ template, onPreview, onInstall, isInstalling }: TemplateCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{template.name}</h3>
            {template.authorName && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('marketplace.card.by', { author: template.authorName })}
              </p>
            )}
          </div>
          {template.isFeatured && (
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 shrink-0" />
          )}
        </div>
        {template.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {template.description}
          </p>
        )}
      </CardHeader>

      <CardContent className="pb-3 flex-1">
        <div className="flex flex-wrap gap-1">
          {template.category && (
            <Badge variant="secondary" className="text-xs">
              {template.category}
            </Badge>
          )}
          {template.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>

      <CardFooter className="pt-0 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {t('marketplace.card.installs', { count: template.installsCount })}
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => onPreview(template)}
          >
            <Eye className="h-3 w-3" />
            {t('marketplace.card.preview')}
          </Button>
          <Button
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={isInstalling}
            onClick={() => onInstall(template.id)}
          >
            <Download className="h-3 w-3" />
            {t('marketplace.card.install')}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
