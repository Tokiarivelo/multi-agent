import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { analyticsApi, TokenUsageFilters } from '../api/analytics.api';

export function useTokenUsage(
  filters: Omit<TokenUsageFilters, 'userId'> & { isTest?: boolean; enabled?: boolean },
) {
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string })?.id ?? '';
  const { enabled = true, ...rest } = filters;

  return useQuery({
    queryKey: ['token-usage', userId, rest],
    queryFn: () => analyticsApi.getTokenUsage({ ...rest, userId }),
    enabled: !!userId && enabled,
    staleTime: 30_000,
  });
}
