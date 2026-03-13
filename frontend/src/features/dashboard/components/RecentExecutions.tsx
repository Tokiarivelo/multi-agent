'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlayCircle, ChevronRight, Hash, Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { cn, getStatusColor } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Execution } from '@/types';

interface RecentExecutionsProps {
  executions: Execution[];
}

export function RecentExecutions({ executions }: RecentExecutionsProps) {
  const { t } = useTranslation();

  return (
    <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md overflow-hidden">
      <CardHeader className="border-b border-border/10 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
            <PlayCircle className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold">
              {t('dashboard.recent_executions.title')}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('dashboard.recent_executions.subtitle')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {executions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Terminal className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-medium">
              {t('dashboard.recent_executions.no_executions')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            {executions.slice(0, 5).map((execution) => (
              <Link
                key={execution.id}
                href={`/executions/${execution.id}`}
                className="flex items-center justify-between p-4 hover:bg-amber-500/5 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-muted/40 group-hover:bg-amber-500/10 group-hover:text-amber-500 transition-colors">
                    <Hash className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-bold text-sm group-hover:text-amber-500 transition-colors">
                      {execution.id.slice(0, 12)}...
                    </p>
                    <p className="text-xs text-muted-foreground font-medium">
                      {execution.workflow?.name || t('dashboard.recent_executions.unknown_workflow')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge 
                    variant={getStatusColor(execution.status)}
                    className={cn(
                      "text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 h-5",
                      execution.status === 'running' && "animate-pulse"
                    )}
                  >
                    {execution.status}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:translate-x-1 group-hover:text-amber-500 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
