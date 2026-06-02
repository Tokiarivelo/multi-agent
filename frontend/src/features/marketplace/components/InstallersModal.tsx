'use client';

import { useTranslation } from 'react-i18next';
import { useInstallers } from '../hooks/useMarketplace';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { formatRelativeTime } from '@/lib/utils';

interface InstallersModalProps {
  templateId: string;
  templateName: string;
  userId: string;
  open: boolean;
  onClose: () => void;
}

export function InstallersModal({
  templateId,
  templateName,
  userId,
  open,
  onClose,
}: InstallersModalProps) {
  const { t } = useTranslation();
  const { data: installers = [], isLoading } = useInstallers(open ? templateId : null, userId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('marketplace.installers.title', { name: templateName })}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <LoadingSpinner />
        ) : installers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('marketplace.installers.empty')}
          </p>
        ) : (
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {installers.map((inst) => (
              <div key={inst.installerId} className="flex items-center justify-between py-3 px-1">
                <div>
                  <p className="text-sm font-medium">
                    {`${inst.firstName} ${inst.lastName}`.trim() || inst.email}
                  </p>
                  <p className="text-xs text-muted-foreground">{inst.email}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(inst.installedAt)}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-right">
          {t('marketplace.installers.count', { count: installers.length })}
        </p>
      </DialogContent>
    </Dialog>
  );
}
