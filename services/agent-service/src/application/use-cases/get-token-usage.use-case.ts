import { Injectable } from '@nestjs/common';
import {
  TokenUsageRepository,
  TokenUsageFilters,
  PaginatedTokenUsage,
  ChartFilters,
  ChartDataPoint,
} from '../../infrastructure/persistence/token-usage.repository';

@Injectable()
export class GetTokenUsageUseCase {
  constructor(private readonly tokenUsageRepository: TokenUsageRepository) {}

  async execute(filters: TokenUsageFilters): Promise<PaginatedTokenUsage> {
    return this.tokenUsageRepository.findMany({
      userId: filters.userId,
      agentId: filters.agentId,
      model: filters.model,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
    });
  }

  async getChart(filters: ChartFilters): Promise<{ period: string; data: ChartDataPoint[] }> {
    const data = await this.tokenUsageRepository.getChartData(filters);
    return { period: filters.period, data };
  }
}
