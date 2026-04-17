'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Model } from '@/types';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Trash, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeleteModel } from '../hooks/useModels';
import { EditModelModal } from './EditModelModal';
import { DeleteGuardDialog } from '@/components/shared/DeleteGuardDialog';
import { useDeleteGuard } from '@/hooks/useDeleteGuard';
import { toast } from 'sonner';

interface ModelActionMenuProps {
  model: Model;
}

export function ModelActionMenu({ model }: ModelActionMenuProps) {
  const { t } = useTranslation();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const deleteModelMutation = useDeleteModel();
  const deleteGuard = useDeleteGuard('model');

  const handleDeleteClick = () => {
    deleteGuard.openGuard(model.id);
  };

  const confirmDelete = () => {
    deleteModelMutation.mutate(model.id, {
      onSuccess: () => {
        toast.success(t('models.deleteSuccess', { name: model.name }));
        deleteGuard.close();
      },
      onError: () => {
        toast.error(t('models.deleteError'));
        deleteGuard.close();
      },
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0" disabled={deleteGuard.isChecking}>
            <span className="sr-only">Open menu</span>
            {deleteGuard.isChecking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setIsEditModalOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            {t('models.actions.edit')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive">
            <Trash className="mr-2 h-4 w-4" />
            {t('models.actions.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isEditModalOpen && (
        <EditModelModal model={model} onClose={() => setIsEditModalOpen(false)} />
      )}

      <DeleteGuardDialog
        open={deleteGuard.open}
        onOpenChange={(open) => {
          if (!open) deleteGuard.close();
        }}
        entityName={model.name}
        entityType={t('deleteGuard.types.model')}
        dependencies={deleteGuard.dependencies}
        isChecking={deleteGuard.isChecking}
        isDeleting={deleteModelMutation.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
