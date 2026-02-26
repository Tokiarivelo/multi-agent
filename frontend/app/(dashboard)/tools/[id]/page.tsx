"use client";

import { useTool } from "@/features/tools/hooks/useTools";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { use } from "react";
import { getStatusColor } from "@/lib/utils";

export default function ToolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: tool, isLoading, error } = useTool(id);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-destructive">Error loading tool</div>;
  if (!tool) return <div>Tool not found</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">{tool.name}</h2>
        <p className="text-muted-foreground">{tool.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tool Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Type</label>
              <p><Badge variant="outline">{tool.type}</Badge></p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <p><Badge variant={getStatusColor(tool.status) as "default" | "success" | "warning" | "destructive"}>{tool.status}</Badge></p>
            </div>
          </div>

          {tool.schema && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Schema</label>
              <pre className="mt-2 p-4 bg-gray-50 rounded-md text-xs overflow-auto">
                {JSON.stringify(tool.schema, null, 2)}
              </pre>
            </div>
          )}

          {tool.config && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Configuration</label>
              <pre className="mt-2 p-4 bg-gray-50 rounded-md text-xs overflow-auto">
                {JSON.stringify(tool.config, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
