'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Workflow, ChevronRight, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Workflow as WorkflowType } from '@/types';

interface RecentWorkflowsProps {
  workflows: WorkflowType[];
}

export function RecentWorkflows({ workflows }: RecentWorkflowsProps) {
  const { t } = useTranslation();

  return (
    <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md overflow-hidden">
      <CardHeader className="border-b border-border/10 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-500/10 text-violet-500">
            <Workflow className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold">
              {t('dashboard.recent_workflows.title')}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('dashboard.recent_workflows.subtitle')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Layers className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-medium">
              {t('dashboard.recent_workflows.no_workflows')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            {workflows.slice(0, 5).map((workflow) => (
              <Link
                key={workflow.id}
                href={`/workflows/${workflow.id}`}
                className="flex items-center justify-between p-4 hover:bg-violet-500/5 transition-colors group"
              >
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center font-bold text-xs text-muted-foreground group-hover:bg-violet-500/10 group-hover:text-violet-500 transition-colors">
                    {workflow.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-bold text-sm group-hover:text-violet-500 transition-colors">
                      {workflow.name}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {workflow.definition?.nodes?.length || 0} {t('dashboard.recent_workflows.nodes')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full border",
                    workflow.status === 'ACTIVE' || workflow.status === 'active'
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                  )}>
                    {workflow.status}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:translate-x-1 group-hover:text-violet-500 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
