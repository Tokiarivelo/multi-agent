'use client';

import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useRoleErrorStore } from '@/store/role-error.store';

const ROLE_LABELS: Record<string, string> = {
  editor: 'Editor',
  executor: 'Executor',
  viewer: 'Viewer',
};

function parseRequiredRole(msg: string): string | null {
  const match = msg.match(/\b(EDITOR|EXECUTOR|VIEWER)\b/i);
  return match ? (ROLE_LABELS[match[1].toLowerCase()] ?? match[1]) : null;
}

export function RoleErrorModal() {
  const { t } = useTranslation();
  const { message, clear } = useRoleErrorStore();

  const requiredRole = message ? parseRequiredRole(message) : null;

  return (
    <Dialog open={!!message} onOpenChange={(open) => !open && clear()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex flex-col items-center gap-3 pb-1">
            <div className="rounded-full bg-destructive/10 p-4">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
            <DialogTitle className="text-xl text-center">
              {t('roleError.title')}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-3 text-center px-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t('roleError.description')}
          </p>
          {requiredRole && (
            <p className="rounded-lg border bg-muted/50 px-4 py-2.5 text-sm font-medium">
              {t('roleError.requiredRole', { role: requiredRole })}
            </p>
          )}
          {message && !requiredRole && (
            <p className="rounded-lg border bg-muted/50 px-4 py-2.5 text-xs text-muted-foreground text-left">
              {message}
            </p>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button className="w-full" onClick={clear}>
            {t('roleError.dismiss')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
