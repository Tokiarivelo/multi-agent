import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { marketplaceApi } from '../api/marketplace.api';
import { useAuthStore } from '@/store/auth.store';

export function useInstallTemplate() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (templateId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      return marketplaceApi.install(templateId, user.id);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-templates'] });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success(t('marketplace.install.success'));
      router.push(`/workflows/${result.id}`);
    },
    onError: (error) => {
      const msg =
        error instanceof AxiosError
          ? (error.response?.data as { message?: string })?.message ??
            t('marketplace.install.error')
          : t('marketplace.install.error');
      toast.error(msg);
    },
  });
}
