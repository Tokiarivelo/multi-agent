"use client";

import { useTools } from "../hooks/useTools";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { getStatusColor } from "@/lib/utils";

export function ToolList() {
  const { data, isLoading, error } = useTools();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-destructive">Error loading tools</div>;

  const tools = data?.data || [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Tools</h2>
        <p className="text-muted-foreground">Available tools for agents</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tools</CardTitle>
          <CardDescription>
            {tools.length} tool{tools.length !== 1 ? "s" : ""} available
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tools.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No tools available</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tools.map((tool) => (
                  <TableRow key={tool.id}>
                    <TableCell className="font-medium">
                      <Link href={`/tools/${tool.id}`} className="hover:underline">
                        {tool.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tool.description}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{tool.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(tool.status) as "default" | "success" | "warning" | "destructive"}>
                        {tool.status}
                      </Badge>
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
