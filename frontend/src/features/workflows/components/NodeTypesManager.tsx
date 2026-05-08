'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Search, Trash2, RotateCcw, Boxes } from 'lucide-react';
import { NODE_TYPE_REGISTRY } from './nodeTypes';
import { useNodePreferencesStore } from '../store/nodePreferences.store';
import { cn } from '@/lib/utils';

export function NodeTypesManager() {
  const { t, i18n } = useTranslation();
  const isFr = i18n.language.startsWith('fr');
  const [search, setSearch] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);

  const { disabledNodeTypes, deletedNodeTypes, toggleDisable, deleteNodeType, restoreNodeType } =
    useNodePreferencesStore();

  const filtered = NODE_TYPE_REGISTRY.filter((n) => {
    const isDeleted = deletedNodeTypes.includes(n.id);
    if (!showDeleted && isDeleted) return false;
    if (showDeleted && !isDeleted) return false;
    const label = isFr ? n.labelFr : n.label;
    const desc = isFr ? n.descriptionFr : n.description;
    return (
      label.toLowerCase().includes(search.toLowerCase()) ||
      desc.toLowerCase().includes(search.toLowerCase())
    );
  });

  const activeCount = NODE_TYPE_REGISTRY.filter(
    (n) => !disabledNodeTypes.includes(n.id) && !deletedNodeTypes.includes(n.id),
  ).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg border border-primary/20">
            <Boxes className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('nodes.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('nodes.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {activeCount} / {NODE_TYPE_REGISTRY.length} {t('nodes.active')}
          </Badge>
          {deletedNodeTypes.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleted((v) => !v)}
              className="gap-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {showDeleted ? t('nodes.showActive') : t('nodes.showDeleted')} ({deletedNodeTypes.length})
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('nodes.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Info banner when showing deleted */}
      {showDeleted && (
        <div className="bg-muted/50 rounded-lg px-4 py-3 text-sm text-muted-foreground border border-border/40">
          {t('nodes.deletedBanner')}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((node) => {
          const Icon = node.icon;
          const isDisabled = disabledNodeTypes.includes(node.id);
          const isDeleted = deletedNodeTypes.includes(node.id);
          const label = isFr ? node.labelFr : node.label;
          const description = isFr ? node.descriptionFr : node.description;

          return (
            <div
              key={node.id}
              className={cn(
                'rounded-xl border p-4 space-y-3 transition-all duration-200',
                isDeleted
                  ? 'border-border/30 bg-muted/20 opacity-60'
                  : isDisabled
                    ? 'border-border/40 bg-muted/30 opacity-70'
                    : 'border-border/50 bg-card hover:shadow-sm',
              )}
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      'rounded-lg p-1.5 border shrink-0',
                      node.bgColor,
                      node.borderColor,
                    )}
                  >
                    <Icon className={cn('h-4 w-4', node.color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{label}</p>
                    <Badge variant="outline" className="text-[10px] h-4 font-mono mt-0.5">
                      {node.id}
                    </Badge>
                  </div>
                </div>

                {/* Status badge */}
                {isDeleted ? (
                  <Badge variant="destructive" className="text-[10px] shrink-0">
                    {t('nodes.statusDeleted')}
                  </Badge>
                ) : isDisabled ? (
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {t('nodes.statusDisabled')}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] shrink-0 border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                  >
                    {t('nodes.statusEnabled')}
                  </Badge>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                {isDeleted ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs h-7"
                    onClick={() => restoreNodeType(node.id)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t('nodes.restore')}
                  </Button>
                ) : (
                  <>
                    {/* Enable / Disable toggle */}
                    <button
                      onClick={() => !['START', 'END'].includes(node.id) && toggleDisable(node.id)}
                      disabled={['START', 'END'].includes(node.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-full px-2.5 py-1 text-xs border transition-colors',
                        ['START', 'END'].includes(node.id)
                          ? 'opacity-40 cursor-not-allowed border-border/30 text-muted-foreground'
                          : isDisabled
                            ? 'border-border/50 bg-muted/40 text-muted-foreground hover:bg-muted/70'
                            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-2 w-2 rounded-full',
                          isDisabled ? 'bg-muted-foreground' : 'bg-emerald-500',
                        )}
                      />
                      {isDisabled ? t('nodes.disabled') : t('nodes.enabled')}
                    </button>

                    {/* Delete button — not allowed for START/END */}
                    {!['START', 'END'].includes(node.id) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('nodes.deleteTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('nodes.deleteDesc', { label })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('nodes.deleteCancel')}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteNodeType(node.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t('nodes.deleteConfirm')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground text-sm">
            {t('nodes.empty')}
          </div>
        )}
      </div>
    </div>
  );
}
