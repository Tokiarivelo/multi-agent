"use client";

import { useExecutions } from "../hooks/useExecutions";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { formatRelativeTime, getStatusColor } from "@/lib/utils";

export function ExecutionList() {
  const { data, isLoading, error } = useExecutions();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-destructive">Error loading executions</div>;

  const executions = data?.data || [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Executions</h2>
        <p className="text-muted-foreground">Workflow execution history</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Executions</CardTitle>
          <CardDescription>
            {executions.length} execution{executions.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {executions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No executions yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map((execution) => {
                  const duration = execution.startedAt && execution.completedAt
                    ? Math.round((new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000)
                    : null;

                  return (
                    <TableRow key={execution.id}>
                      <TableCell className="font-medium">
                        <Link href={`/executions/${execution.id}`} className="hover:underline">
                          {execution.id.slice(0, 8)}...
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {execution.workflow?.name || execution.workflowId.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(execution.status) as "default" | "success" | "warning" | "destructive"}>
                          {execution.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {execution.startedAt ? formatRelativeTime(execution.startedAt) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {execution.completedAt ? formatRelativeTime(execution.completedAt) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {duration ? `${duration}s` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
