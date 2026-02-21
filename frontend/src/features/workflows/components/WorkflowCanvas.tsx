'use client';

import { Workflow } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface WorkflowCanvasProps {
  workflow: Workflow;
}

export function WorkflowCanvas({ workflow }: WorkflowCanvasProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow Visualization</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border border-border/50 rounded-xl p-8 bg-muted/20 backdrop-blur-sm min-h-[400px] shadow-inner">
          <div className="text-center text-muted-foreground">
            <p>Visual workflow canvas coming soon</p>
            <p className="text-sm mt-2">
              Nodes: {workflow.nodes?.length || 0} | Edges: {workflow.edges?.length || 0}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
