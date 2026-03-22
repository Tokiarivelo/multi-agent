import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../api/userApi';
import { toast } from 'sonner';

export function useWorkspaceSettings(isOpen: boolean) {
  const queryClient = useQueryClient();
  const [newExtension, setNewExtension] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['userSettings'],
    queryFn: () => userApi.getSettings(),
    enabled: isOpen,
  });

  const extensions = data?.settings?.indexableExtensions || [];

  const updateMutation = useMutation({
    mutationFn: (extensions: string[]) =>
      userApi.updateSettings({ indexableExtensions: extensions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
      toast.success('Settings saved successfully');
    },
    onError: (error) => {
      console.error('Failed to update settings:', error);
      toast.error('Failed to save settings');
    },
  });

  const handleAddExtension = (e: React.FormEvent) => {
    e.preventDefault();
    const ext = newExtension.replace(/^\./, '').trim().toLowerCase();
    if (!ext) return;
    if (extensions.includes(ext)) {
      toast.error('Extension already exists');
      return;
    }
    updateMutation.mutate([...extensions, ext]);
    setNewExtension('');
  };

  const handleRemoveExtension = (ext: string) => {
    updateMutation.mutate(extensions.filter((item) => item !== ext));
  };

  return {
    extensions,
    isLoading,
    newExtension,
    setNewExtension,
    handleAddExtension,
    handleRemoveExtension,
    isPending: updateMutation.isPending,
  };
}
