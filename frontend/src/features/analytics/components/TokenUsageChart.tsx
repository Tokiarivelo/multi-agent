'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartPeriod, ChartDataPoint } from '../api/analytics.api';
import { useTokenUsageChart } from '../hooks/useTokenUsageChart';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { TrendingUp } from 'lucide-react';

// Deterministic palette: each new model gets the next colour
const PALETTE = [
  '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#3b82f6', '#ec4899', '#84cc16',
];

function getColor(index: number) {
  return PALETTE[index % PALETTE.length];
}

/** Pivot flat [{date, model, tokens}] → [{date, model1: n, model2: n}] */
function pivot(data: ChartDataPoint[]): Record<string, string | number>[] {
  const byDate = new Map<string, Record<string, string | number>>();

  for (const point of data) {
    const key = new Date(point.date).toISOString();
    if (!byDate.has(key)) byDate.set(key, { date: key });
    byDate.get(key)![point.model] = point.tokens;
  }

  return Array.from(byDate.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

function formatDate(iso: string, period: ChartPeriod) {
  const d = new Date(iso);
  if (period === 'monthly') return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  if (period === 'weekly') return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const PERIODS: { label: string; value: ChartPeriod }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
];

interface Props {
  period: ChartPeriod;
  onPeriodChange: (p: ChartPeriod) => void;
  agentId?: string;
  isTest?: boolean;
  fromDate?: string;
  toDate?: string;
}

export function TokenUsageChart({ period, onPeriodChange, agentId, isTest, fromDate, toDate }: Props) {
  const { data, isLoading } = useTokenUsageChart({ period, agentId, isTest, fromDate, toDate });

  const rawData = data?.data ?? [];
  const models = [...new Set(rawData.map((d) => d.model))];
  const chartData = pivot(rawData);

  return (
    <div className="space-y-4">
      {/* Period toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-violet-500" />
          <span className="font-semibold text-sm">Token consumption over time</span>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
          {PERIODS.map(({ label, value }) => (
            <Button
              key={value}
              size="sm"
              variant={period === value ? 'default' : 'ghost'}
              className={
                period === value
                  ? 'h-7 px-3 text-xs bg-violet-500 hover:bg-violet-600 text-white'
                  : 'h-7 px-3 text-xs text-muted-foreground hover:text-foreground'
              }
              onClick={() => onPeriodChange(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 w-full">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <LoadingSpinner className="h-8 w-8 text-violet-500" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            No data for selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                {models.map((model, i) => (
                  <linearGradient key={model} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={getColor(i)} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={getColor(i)} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => formatDate(v, period)}
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                width={42}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  fontSize: 12,
                }}
                labelFormatter={(v) => formatDate(v as string, period)}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => [Number(value ?? 0).toLocaleString() + ' tokens', String(name ?? '')] as [string, string]}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(name) => name.length > 24 ? name.slice(0, 24) + '…' : name}
              />
              {models.map((model, i) => (
                <Area
                  key={model}
                  type="monotone"
                  dataKey={model}
                  stroke={getColor(i)}
                  strokeWidth={2}
                  fill={`url(#grad-${i})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
