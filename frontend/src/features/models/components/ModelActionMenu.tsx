import { useState } from 'react';
import { Model } from '@/types';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Trash } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteModel } from '../hooks/useModels';
import { EditModelModal } from './EditModelModal';
import { agentsApi } from '@/features/agents/api/agents.api';
import { toast } from 'sonner';

interface ModelActionMenuProps {
  model: Model;
}

export function ModelActionMenu({ model }: ModelActionMenuProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);

  const deleteModelMutation = useDeleteModel();

  const handleDeleteClick = async () => {
    setIsCheckingUsage(true);
    try {
      const response = await agentsApi.getAll(1, 1000);
      const isUsed = response.data.some((agent) => agent.modelId === model.id);

      if (isUsed) {
        toast.error(`Cannot delete model "${model.name}" because it is currently used by one or more agents.`);
        return;
      }
      setIsDeleteDialogOpen(true);
    } catch {
      toast.error('Failed to check if the model is currently in use.');
    } finally {
      setIsCheckingUsage(false);
    }
  };

  const confirmDelete = () => {
    deleteModelMutation.mutate(model.id, {
      onSuccess: () => {
        toast.success(`Model ${model.name} deleted successfully.`);
        setIsDeleteDialogOpen(false);
      },
      onError: () => {
        toast.error('Failed to delete model.');
        setIsDeleteDialogOpen(false);
      },
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0" disabled={isCheckingUsage}>
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setIsEditModalOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive">
            <Trash className="mr-2 h-4 w-4" />
            Delete Model
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isEditModalOpen && (
        <EditModelModal model={model} onClose={() => setIsEditModalOpen(false)} />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolute sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the model{' '}
              <span className="font-semibold text-foreground">{model.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteModelMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleteModelMutation.isPending}
            >
              {deleteModelMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
