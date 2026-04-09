import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { analyticsApi, ChartFilters, ChartPeriod } from '../api/analytics.api';

export function useTokenUsageChart(
  filters: Omit<ChartFilters, 'userId'> & { period: ChartPeriod },
) {
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string })?.id ?? '';

  return useQuery({
    queryKey: ['token-usage-chart', userId, filters],
    queryFn: () => analyticsApi.getTokenUsageChart({ ...filters, userId }),
    enabled: !!userId,
    staleTime: 30_000,
  });
}
