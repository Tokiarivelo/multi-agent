'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Workflow, Bot, PlayCircle, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number;
  subValue: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

function StatCard({ title, value, subValue, icon: Icon, color }: StatCardProps) {
  return (
    <Card className="overflow-hidden border-none shadow-lg bg-card/60 backdrop-blur-md hover:bg-card/80 transition-all duration-300 group">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-bold tracking-tight text-muted-foreground group-hover:text-foreground transition-colors">
          {title}
        </CardTitle>
        <div className={cn("p-2 rounded-lg bg-muted/50 group-hover:scale-110 transition-transform duration-300", color)}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-extrabold tracking-tight">{value}</div>
        <p className="text-xs font-medium text-muted-foreground mt-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {subValue}
        </p>
      </CardContent>
      <div className={cn("h-1 w-full mt-2 transition-all duration-500 group-hover:h-1.5", color)} />
    </Card>
  );
}

interface DashboardStatsProps {
  stats: {
    workflows: { total: number; active: number };
    agents: { total: number; active: number };
    executions: { total: number; running: number };
    completed: { total: number };
  };
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title={t('dashboard.stats.workflows')}
        value={stats.workflows.total}
        subValue={`${stats.workflows.active} ${t('dashboard.stats.active')}`}
        icon={Workflow}
        color="bg-violet-500/20 text-violet-500"
      />
      <StatCard
        title={t('dashboard.stats.agents')}
        value={stats.agents.total}
        subValue={`${stats.agents.active} ${t('dashboard.stats.active')}`}
        icon={Bot}
        color="bg-blue-500/20 text-blue-500"
      />
      <StatCard
        title={t('dashboard.stats.executions')}
        value={stats.executions.total}
        subValue={`${stats.executions.running} ${t('dashboard.stats.running')}`}
        icon={PlayCircle}
        color="bg-amber-500/20 text-amber-500"
      />
      <StatCard
        title={t('dashboard.stats.completed')}
        value={stats.completed.total}
        subValue={t('dashboard.stats.period')}
        icon={CheckCircle}
        color="bg-emerald-500/20 text-emerald-500"
      />
    </div>
  );
}
