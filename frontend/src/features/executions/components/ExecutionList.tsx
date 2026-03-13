"use client";

import { useExecutions } from "../hooks/useExecutions";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { formatDate, getStatusColor } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Activity, Clock, Hash, Play, Terminal, AlertCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ExecutionList() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useExecutions();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-muted/10 rounded-3xl border border-dashed border-border/60">
        <LoadingSpinner className="h-10 w-10 text-violet-500" />
        <p className="mt-4 text-sm font-medium text-muted-foreground animate-pulse">
          {t("workflows.logs.waiting")}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-destructive/5 rounded-3xl border border-destructive/20 text-destructive">
        <AlertCircle className="h-10 w-10 mb-4" />
        <p className="font-semibold">{t("workflows.execution.error_title")}</p>
      </div>
    );
  }

  const executions = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between px-1">
        <div className="space-y-1">
          <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <Activity className="h-8 w-8 text-violet-500" />
            {t("workflows.execution_list.title")}
          </h2>
          <p className="text-muted-foreground font-medium pl-1">
            {t("workflows.subtitle")}
          </p>
        </div>
        <Badge variant="secondary" className="font-mono px-3 py-1 text-sm bg-violet-500/10 text-violet-600 border-none shadow-none">
          {executions.length} {t("workflows.total")}
        </Badge>
      </div>

      <Card className="overflow-hidden border-none shadow-2xl bg-card/60 backdrop-blur-md">
        <CardContent className="p-0">
          {executions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="p-4 rounded-full bg-muted/30 shadow-xs mb-4">
                <Terminal className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-bold text-foreground/80">
                {t("workflows.execution_list.empty.title")}
              </h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-[280px]">
                {t("workflows.execution_list.empty.desc")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-border/40">
                    <TableHead className="w-[120px] font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                        {t("workflows.execution_list.table.id")}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <Play className="h-3.5 w-3.5 text-muted-foreground" />
                        {t("workflows.execution_list.table.workflow")}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                        {t("workflows.execution_list.table.status")}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {t("workflows.execution_list.table.started")}
                      </div>
                    </TableHead>
                    <TableHead className="text-right font-bold text-foreground pr-6">
                      <div className="flex items-center justify-end gap-2">
                        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                        {t("workflows.execution_list.table.duration")}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executions.map((execution) => {
                    const duration = execution.startedAt && execution.completedAt
                      ? Math.round((new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000)
                      : null;
                    
                    const isFailed = execution.status === 'failed';

                    return (
                      <TableRow 
                        key={execution.id} 
                        className={cn(
                          "group transition-all duration-200 border-border/30",
                          isFailed ? "hover:bg-destructive/5" : "hover:bg-muted/40"
                        )}
                      >
                        <TableCell className="font-mono text-xs">
                          <Link href={`/executions/${execution.id}`} className="hover:text-violet-500 hover:underline transition-colors flex items-center gap-1.5">
                            {execution.id.slice(0, 8)}
                            <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm">
                              {execution.workflow?.name || execution.workflowId.slice(0, 8)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={getStatusColor(execution.status)}
                            className={cn(
                              "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 h-5",
                              execution.status === 'running' && "animate-pulse"
                            )}
                          >
                            {execution.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-medium">
                          {execution.startedAt ? formatDate(execution.startedAt) : "—"}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <span className={cn(
                            "text-xs font-mono font-bold px-2 py-1 rounded bg-muted/30 border border-border/30",
                            isFailed && "text-destructive border-destructive/20 bg-destructive/5"
                          )}>
                            {duration !== null ? `${duration}s` : "—"}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
