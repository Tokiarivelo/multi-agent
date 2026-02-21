'use client';

import { useModels } from '../hooks/useModels';
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
import Link from 'next/link';
import { getStatusColor } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { CreateModelModal } from './CreateModelModal';
import { ApiKeysManager } from './ApiKeysManager';

export function ModelList() {
  const { data, isLoading, error } = useModels();
  const [isCreateModelModalOpen, setIsCreateModelModalOpen] = useState(false);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-destructive">Error loading models</div>;

  const models = data?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Models</h2>
          <p className="text-muted-foreground">Configured language models</p>
        </div>
        <Button onClick={() => setIsCreateModelModalOpen(true)}>Add New Model</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Models</CardTitle>
          <CardDescription>
            {models.length} model{models.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {models.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No models configured</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Model ID</TableHead>
                  <TableHead>Max Tokens</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell className="font-medium">
                      <Link href={`/models/${model.id}`} className="hover:underline">
                        {model.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{model.provider}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{model.modelId}</TableCell>
                    <TableCell>{model.maxTokens.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          getStatusColor(model.status || 'available') as
                            | 'default'
                            | 'success'
                            | 'warning'
                            | 'destructive'
                        }
                      >
                        {model.status || 'available'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="pt-8">
        <ApiKeysManager />
      </div>

      {isCreateModelModalOpen && (
        <CreateModelModal onClose={() => setIsCreateModelModalOpen(false)} />
      )}
    </div>
  );
}
