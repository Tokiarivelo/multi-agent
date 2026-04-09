import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export type ChartPeriod = 'daily' | 'weekly' | 'monthly';

export interface ChartFilters {
  userId?: string;
  agentId?: string;
  isTest?: boolean;
  fromDate?: Date;
  toDate?: Date;
  period: ChartPeriod;
}

export interface ChartDataPoint {
  date: Date;
  model: string;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  executions: number;
}

export interface CreateTokenUsageData {
  userId: string;
  agentId: string;
  executionId?: string;
  workflowId?: string;
  nodeId?: string;
  isTest?: boolean;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputPreview?: string;
  outputPreview?: string;
  success: boolean;
  errorMessage?: string;
}

export interface TokenUsageFilters {
  userId?: string;
  agentId?: string;
  model?: string;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
}

export interface TokenUsageRecord {
  id: string;
  timestamp: Date;
  userId: string;
  agentId: string;
  executionId: string | null;
  workflowId: string | null;
  nodeId: string | null;
  isTest: boolean;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputPreview: string | null;
  outputPreview: string | null;
  success: boolean;
  errorMessage: string | null;
  agentName?: string;
}

export interface PaginatedTokenUsage {
  data: TokenUsageRecord[];
  total: number;
  page: number;
  limit: number;
  totalTokensSum: number;
}

@Injectable()
export class TokenUsageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateTokenUsageData): Promise<void> {
    await this.prisma.tokenUsage.create({
      data: {
        userId: data.userId,
        agentId: data.agentId,
        executionId: data.executionId,
        workflowId: data.workflowId,
        nodeId: data.nodeId,
        isTest: data.isTest ?? false,
        model: data.model,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.totalTokens,
        inputPreview: data.inputPreview,
        outputPreview: data.outputPreview,
        success: data.success,
        errorMessage: data.errorMessage,
      },
    });
  }

  async findMany(filters: TokenUsageFilters): Promise<PaginatedTokenUsage> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.userId) {
      // Include records saved before userId propagation was fixed (stored as 'unknown')
      where.OR = [{ userId: filters.userId }, { userId: 'unknown' }];
    }
    if (filters.agentId) where.agentId = filters.agentId;
    if (filters.model) where.model = filters.model;
    if (filters.fromDate || filters.toDate) {
      where.timestamp = {};
      if (filters.fromDate) where.timestamp.gte = filters.fromDate;
      if (filters.toDate) where.timestamp.lte = filters.toDate;
    }

    const [rows, total, aggregate] = await Promise.all([
      this.prisma.tokenUsage.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
        include: { agent: { select: { name: true } } },
      }),
      this.prisma.tokenUsage.count({ where }),
      this.prisma.tokenUsage.aggregate({ where, _sum: { totalTokens: true } }),
    ]);

    return {
      data: rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        userId: r.userId,
        agentId: r.agentId,
        executionId: r.executionId,
        workflowId: r.workflowId,
        nodeId: r.nodeId,
        isTest: r.isTest,
        model: r.model,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        totalTokens: r.totalTokens,
        inputPreview: r.inputPreview,
        outputPreview: r.outputPreview,
        success: r.success,
        errorMessage: r.errorMessage,
        agentName: (r as any).agent?.name,
      })),
      total,
      page,
      limit,
      totalTokensSum: aggregate._sum.totalTokens ?? 0,
    };
  }

  async getChartData(filters: ChartFilters): Promise<ChartDataPoint[]> {
    const truncMap: Record<ChartPeriod, string> = {
      daily: 'day',
      weekly: 'week',
      monthly: 'month',
    };
    const trunc = Prisma.raw(`'${truncMap[filters.period]}'`);

    const conditions: Prisma.Sql[] = [];

    if (filters.userId) {
      conditions.push(
        Prisma.sql`(tu."userId" = ${filters.userId} OR tu."userId" = 'unknown')`,
      );
    }
    if (filters.agentId) {
      conditions.push(Prisma.sql`tu."agentId" = ${filters.agentId}`);
    }
    if (filters.isTest !== undefined) {
      conditions.push(Prisma.sql`tu."isTest" = ${filters.isTest}`);
    }
    if (filters.fromDate) {
      conditions.push(Prisma.sql`tu."timestamp" >= ${filters.fromDate}`);
    }
    if (filters.toDate) {
      conditions.push(Prisma.sql`tu."timestamp" <= ${filters.toDate}`);
    }

    const where =
      conditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
        : Prisma.empty;

    const rows = await this.prisma.$queryRaw<ChartDataPoint[]>`
      SELECT
        DATE_TRUNC(${trunc}, tu."timestamp")   AS date,
        tu."model"                             AS model,
        SUM(tu."totalTokens")::int             AS tokens,
        SUM(tu."inputTokens")::int             AS "inputTokens",
        SUM(tu."outputTokens")::int            AS "outputTokens",
        COUNT(*)::int                          AS executions
      FROM token_usage tu
      ${where}
      GROUP BY DATE_TRUNC(${trunc}, tu."timestamp"), tu."model"
      ORDER BY date ASC
    `;

    return rows;
  }
}
