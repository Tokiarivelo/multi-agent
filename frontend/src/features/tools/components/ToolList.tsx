'use client';

import { useTools } from '../hooks/useTools';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Wrench, Play } from 'lucide-react';
import Link from 'next/link';
import * as LucideIcons from 'lucide-react';
import { useState } from 'react';
import { Tool } from '@/types';
import { ExecuteToolModal } from './ExecuteToolModal';

const DynamicIcon = ({ name, className }: { name?: string; className?: string }) => {
  if (!name) return <Wrench className={className} />;
  // Attempt to find the icon from lucide-react matching the name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent = (LucideIcons as any)[name] || (LucideIcons as any)[name.charAt(0).toUpperCase() + name.slice(1)];
  if (!IconComponent) return <Wrench className={className} />;
  return <IconComponent className={className} />;
};

export function ToolList() {
  const { data, isLoading, error } = useTools();
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-destructive">Error loading tools</div>;

  const tools = data?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tools</h2>
          <p className="text-muted-foreground">Available tools for agents</p>
        </div>
        <Link href="/tools/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Tool
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tools</CardTitle>
          <CardDescription>
            {tools.length} tool{tools.length !== 1 ? 's' : ''} available
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
                  <TableHead className="w-[50px]">Icon</TableHead>
                  <TableHead>Tool</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Origin</TableHead>
                  <TableHead>Params</TableHead>
                  <TableHead className="w-[80px]">Test</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tools.map((tool) => (
                  <TableRow key={tool.id}>
                    <TableCell>
                      <div className="bg-muted/50 p-2 rounded-md inline-block">
                        <DynamicIcon name={tool.icon} className="h-4 w-4 text-primary" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col space-y-1">
                        <Link href={`/tools/${tool.id}`} className="font-semibold hover:underline flex items-center gap-2">
                          {tool.name}
                        </Link>
                        <span className="text-xs text-muted-foreground line-clamp-1">{tool.description}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-background">{tool.category || 'CUSTOM'}</Badge>
                    </TableCell>
                    <TableCell>
                      {tool.isBuiltIn ? (
                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-transparent">Built-in</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-transparent">Custom</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {Array.isArray(tool.parameters) ? tool.parameters.length : 0} defined
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        onClick={() => setSelectedTool(tool)}
                      >
                        <Play className="h-3 w-3" />
                        Test
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ExecuteToolModal
        tool={selectedTool}
        open={!!selectedTool}
        onOpenChange={(open) => { if (!open) setSelectedTool(null); }}
      />
    </div>
  );
}
