'use client';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import type { CollaboratorRole, WorkflowCollaborator } from '@/types';

interface Props {
  collaborators: WorkflowCollaborator[];
  onUpdateRole: (id: string, role: CollaboratorRole) => void;
  onRemove: (id: string) => void;
  t: (key: string) => string;
}

export function CollaboratorList({ collaborators, onUpdateRole, onRemove, t }: Props) {
  if (collaborators.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        {t('sharing.collaborators.empty')}
      </p>
    );
  }

  return (
    <div className="rounded-lg border divide-y overflow-hidden">
      {collaborators.map((c) => {
        const displayName =
          [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || c.userId;
        const subtext = c.email && displayName !== c.email ? c.email : c.status;

        return (
          <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{subtext}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <Select
                value={c.role}
                onValueChange={(v) => onUpdateRole(c.id, v as CollaboratorRole)}
              >
                <SelectTrigger className="h-7 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEWER">{t('sharing.roles.viewer')}</SelectItem>
                  <SelectItem value="EXECUTOR">{t('sharing.roles.executor')}</SelectItem>
                  <SelectItem value="EDITOR">{t('sharing.roles.editor')}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onRemove(c.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
