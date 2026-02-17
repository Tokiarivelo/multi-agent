"use client";

import { useModel } from "@/features/models/hooks/useModels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { use } from "react";
import { getStatusColor } from "@/lib/utils";

export default function ModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: model, isLoading, error } = useModel(id);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-destructive">Error loading model</div>;
  if (!model) return <div>Model not found</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">{model.name}</h2>
        <p className="text-muted-foreground">{model.provider} - {model.modelId}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Model Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Provider</label>
              <p><Badge variant="outline">{model.provider}</Badge></p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <p><Badge variant={getStatusColor(model.status) as "default" | "success" | "warning" | "destructive"}>{model.status}</Badge></p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Model ID</label>
              <p className="text-sm font-mono">{model.modelId}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Max Tokens</label>
              <p className="text-sm">{model.maxTokens.toLocaleString()}</p>
            </div>
          </div>

          {model.capabilities && model.capabilities.length > 0 && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Capabilities</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {model.capabilities.map((cap) => (
                  <Badge key={cap} variant="secondary">{cap}</Badge>
                ))}
              </div>
            </div>
          )}

          {model.costPer1kTokens && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Cost per 1K Tokens</label>
              <p className="text-sm">${model.costPer1kTokens.toFixed(4)}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
