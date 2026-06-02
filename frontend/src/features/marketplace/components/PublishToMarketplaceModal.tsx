'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { marketplaceApi } from '../api/marketplace.api';
import { PublishWorkflowPayload } from '../types/marketplace.types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CATEGORIES = [
  'Automation',
  'AI',
  'Data',
  'DevOps',
  'HR',
  'Productivity',
  'Marketing',
  'Analytics',
] as const;

export interface PublishToMarketplaceModalProps {
  open: boolean;
  onClose: () => void;
  workflowId: string;
  workflowName: string;
  userId: string;
  isAdmin?: boolean;
  /** When set, modal is in "update" mode for an already-published workflow */
  isPublished?: boolean;
  initialValues?: {
    name?: string;
    description?: string;
    category?: string;
    tags?: string[];
    previewImageUrl?: string;
  };
}

export function PublishToMarketplaceModal({
  open,
  onClose,
  workflowId,
  workflowName,
  userId,
  isAdmin = false,
  isPublished = false,
  initialValues,
}: PublishToMarketplaceModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [name, setName] = useState(initialValues?.name ?? workflowName);
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [category, setCategory] = useState(initialValues?.category ?? '');
  const [tagsRaw, setTagsRaw] = useState((initialValues?.tags ?? []).join(', '));
  const [previewImageUrl, setPreviewImageUrl] = useState(initialValues?.previewImageUrl ?? '');
  const [isFeatured, setIsFeatured] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parseTags = () =>
    tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

  const publishMutation = useMutation({
    mutationFn: (payload: PublishWorkflowPayload) => marketplaceApi.publish(payload, userId),
    onSuccess: () => {
      toast.success(t('marketplace.publish.success'));
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-templates'] });
      onClose();
    },
    onError: (error: unknown) => {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status === 403) {
        setErrorMessage(t('marketplace.publish.forbiddenInstalled'));
      } else {
        toast.error(t('marketplace.publish.error'));
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      marketplaceApi.updatePublished(workflowId, userId, {
        name,
        description,
        category,
        tags: parseTags(),
        previewImageUrl: previewImageUrl || undefined,
        isFeatured: isAdmin ? isFeatured : undefined,
      }),
    onSuccess: () => {
      toast.success(t('marketplace.update.success'));
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-templates'] });
      onClose();
    },
    onError: () => toast.error(t('marketplace.update.error')),
  });

  const isPending = publishMutation.isPending || updateMutation.isPending;

  function handleSubmit() {
    if (!category) return;
    setErrorMessage(null);

    if (isPublished) {
      updateMutation.mutate();
    } else {
      publishMutation.mutate({
        workflowId,
        name,
        description,
        category,
        tags: parseTags(),
        previewImageUrl: previewImageUrl || undefined,
        isFeatured: isAdmin ? isFeatured : undefined,
      });
    }
  }

  const title = isPublished
    ? t('marketplace.update.title')
    : t('marketplace.publish.title');

  const submitLabel = isPublished
    ? t('marketplace.update.submit')
    : t('marketplace.publish.submit');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {!isPublished && (
            <DialogDescription>{t('marketplace.publish.subtitle')}</DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pub-name">{t('marketplace.publish.nameLabel')}</Label>
            <Input
              id="pub-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('marketplace.publish.namePlaceholder')}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pub-description">{t('marketplace.publish.descriptionLabel')}</Label>
            <Textarea
              id="pub-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('marketplace.publish.descriptionPlaceholder')}
              rows={3}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('marketplace.publish.categoryLabel')}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder={t('marketplace.publish.categoryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pub-tags">{t('marketplace.publish.tagsLabel')}</Label>
            <Input
              id="pub-tags"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder={t('marketplace.publish.tagsPlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pub-preview">{t('marketplace.publish.previewImageLabel')}</Label>
            <Input
              id="pub-preview"
              value={previewImageUrl}
              onChange={(e) => setPreviewImageUrl(e.target.value)}
              placeholder={t('marketplace.publish.previewImagePlaceholder')}
              type="url"
            />
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <input
                id="pub-featured"
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="pub-featured" className="cursor-pointer">
                {t('marketplace.publish.featuredLabel')}
              </Label>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMessage}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {t('marketplace.cancel')}
            </Button>
            <Button type="submit" disabled={isPending || !category}>
              {isPending ? '...' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
