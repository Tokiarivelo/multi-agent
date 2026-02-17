"use client";

import { useWorkflows } from "../hooks/useWorkflows";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Play, Edit } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime, getStatusColor } from "@/lib/utils";

export function WorkflowList() {
  const { data, isLoading, error } = useWorkflows();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-destructive">Error loading workflows</div>;

  const workflows = data?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Workflows</h2>
          <p className="text-muted-foreground">Manage your workflow definitions</p>
        </div>
        <Link href="/workflows/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Workflow
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Workflows</CardTitle>
          <CardDescription>
            {workflows.length} workflow{workflows.length !== 1 ? "s" : ""} total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workflows.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No workflows yet. Create your first one!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Nodes</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map((workflow) => (
                  <TableRow key={workflow.id}>
                    <TableCell className="font-medium">
                      <Link href={`/workflows/${workflow.id}`} className="hover:underline">
                        {workflow.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {workflow.description || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(workflow.status) as "default" | "success" | "warning" | "destructive"}>
                        {workflow.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{workflow.nodes?.length || 0}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeTime(workflow.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link href={`/workflows/${workflow.id}`}>
                          <Button variant="ghost" size="sm" className="gap-1">
                            <Edit className="h-3 w-3" />
                            Edit
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" className="gap-1">
                          <Play className="h-3 w-3" />
                          Run
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
