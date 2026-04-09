'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DependencyItem } from '@/hooks/useDeleteGuard';

interface DeleteGuardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName: string;
  entityType: string;
  dependencies: DependencyItem[] | null;
  isChecking: boolean;
  onConfirm: () => void;
  isDeleting?: boolean;
}

const TYPE_BADGE: Record<DependencyItem['type'], string> = {
  agent: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  workflow: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  tool: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  model: 'bg-green-500/10 text-green-600 border-green-500/20',
};

export function DeleteGuardDialog({
  open,
  onOpenChange,
  entityName,
  entityType,
  dependencies,
  isChecking,
  onConfirm,
  isDeleting = false,
}: DeleteGuardDialogProps) {
  const { t } = useTranslation();

  const hasDependencies = (dependencies?.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasDependencies && (
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            )}
            {hasDependencies
              ? t('deleteGuard.blockedTitle')
              : t('deleteGuard.confirmTitle')}
          </DialogTitle>
          <DialogDescription>
            {isChecking
              ? t('deleteGuard.checking')
              : hasDependencies
              ? t('deleteGuard.blockedDescription', { name: entityName, type: entityType })
              : t('deleteGuard.confirmDescription', { name: entityName })}
          </DialogDescription>
        </DialogHeader>

        {isChecking && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isChecking && hasDependencies && dependencies && (
          <div className="space-y-2 max-h-60 overflow-y-auto py-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('deleteGuard.dependenciesLabel')}
            </p>
            {dependencies.map((dep) => (
              <Link
                key={dep.id}
                href={dep.href}
                onClick={() => onOpenChange(false)}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5 hover:bg-muted/60 transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase font-bold shrink-0 ${TYPE_BADGE[dep.type]}`}
                  >
                    {t(`deleteGuard.types.${dep.type}`)}
                  </Badge>
                  <span className="text-sm font-medium truncate">{dep.name}</span>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
              </Link>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            {t('deleteGuard.cancel')}
          </Button>
          {!hasDependencies && !isChecking && (
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  {t('deleteGuard.deleting')}
                </>
              ) : (
                t('deleteGuard.confirm')
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
