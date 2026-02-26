'use client';

import { WorkflowEditor } from '@/features/workflows/components/WorkflowEditor';
import { Card, CardContent } from '@/components/ui/card';
import { Info } from 'lucide-react';

export default function NewWorkflowPage() {
  return (
    <div className="space-y-6">
      <WorkflowEditor />
      <Card className="border-dashed bg-muted/30">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <div className="rounded-full bg-muted p-3 mb-4">
            <Info className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold mb-1 text-foreground">
            Canvas Editor Unavailable / Éditeur de zone de travail indisponible
          </h3>
          <p className="text-xs">
            Please enter a name and save the workflow first. The visual node editor and execution
            canvas will be available after creation.
          </p>
          <p className="text-xs mt-1">
            Veuillez d&apos;abord saisir un nom et enregistrer le workflow. L&apos;éditeur visuel de
            nœuds et d&apos;exécution seront disponibles après la création.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
