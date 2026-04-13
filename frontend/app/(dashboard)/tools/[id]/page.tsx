'use client';

import { useTool } from '@/features/tools/hooks/useTools';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ExecuteToolModal } from '@/features/tools/components/ExecuteToolModal';
import { Play } from 'lucide-react';
import { use, useState } from 'react';

export default function ToolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: tool, isLoading, error } = useTool(id);
  const [testOpen, setTestOpen] = useState(false);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-destructive">Error loading tool</div>;
  if (!tool) return <div>Tool not found</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">{tool.name}</h2>
          <p className="text-muted-foreground">{tool.description}</p>
        </div>
        <Button className="gap-2" onClick={() => setTestOpen(true)}>
          <Play className="h-4 w-4" />
          Test Tool
        </Button>
      </div>

      <ExecuteToolModal tool={tool} open={testOpen} onOpenChange={setTestOpen} />

      <Card>
        <CardHeader>
          <CardTitle>Tool Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Category</label>
              <div>
                <Badge variant="outline">{tool.category || 'CUSTOM'}</Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Origin</label>
              <div>
                {tool.isBuiltIn ? (
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-transparent">Built-in</Badge>
                ) : (
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-transparent">Custom</Badge>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Icon</label>
            <div>{tool.icon || 'None'}</div>
          </div>

          {tool.parameters && tool.parameters.length > 0 && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Parameters</label>
              <pre className="mt-2 p-4 bg-muted/50 rounded-md text-xs overflow-auto font-mono text-foreground">
                {JSON.stringify(tool.parameters, null, 2)}
              </pre>
            </div>
          )}

          {tool.code && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Code</label>
              <pre className="mt-2 p-4 bg-muted/50 rounded-md text-xs overflow-auto font-mono text-foreground">
                {tool.code}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
