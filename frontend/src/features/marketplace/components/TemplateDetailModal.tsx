'use client';

import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Network } from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useMarketplaceTemplate } from '../hooks/useMarketplace';
import { TemplateListItem } from '../types/marketplace.types';

interface TemplateDetailModalProps {
  template: TemplateListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: (templateId: string) => void;
  isInstalling: boolean;
}

export function TemplateDetailModal({
  template,
  open,
  onOpenChange,
  onInstall,
  isInstalling,
}: TemplateDetailModalProps) {
  const { t } = useTranslation();
  const { data: detail, isLoading } = useMarketplaceTemplate(open ? (template?.id ?? null) : null);

  const nodeCount = Array.isArray(detail?.nodes) ? (detail.nodes as unknown[]).length : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : detail ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <DialogTitle className="flex-1">{detail.name}</DialogTitle>
                {detail.category && <Badge variant="secondary">{detail.category}</Badge>}
              </div>
              {detail.authorName && (
                <DialogDescription>
                  {t('marketplace.card.by', { author: detail.authorName })}
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="space-y-4">
              {detail.description && (
                <p className="text-sm text-muted-foreground">{detail.description}</p>
              )}

              <div className="border-t pt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Network className="h-4 w-4" />
                  {t('marketplace.detail.nodes', { count: nodeCount })}
                </span>
                <span>{t('marketplace.card.installs', { count: detail.installsCount })}</span>
              </div>

              {detail.tags.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t('marketplace.detail.tags')}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {detail.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('marketplace.cancel')}
              </Button>
              <Button
                disabled={isInstalling}
                onClick={() => onInstall(detail.id)}
                className="gap-2"
              >
                {isInstalling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('marketplace.install.loading')}
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    {t('marketplace.card.install')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
