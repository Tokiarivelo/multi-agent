'use client';

import { useApiKeys, useDeleteApiKey } from '../hooks/useModels';
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
import { useState } from 'react';
import { CreateApiKeyModal } from './CreateApiKeyModal';
import { useAuth } from '@/features/auth/hooks/useAuth';

export function ApiKeysManager() {
  const { user } = useAuth();
  const { data, isLoading, error } = useApiKeys(user?.id);
  const deleteMutation = useDeleteApiKey(user?.id);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  if (!user) return null;
  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-destructive">Error loading API keys</div>;

  const apiKeys = data?.data || [];

  return (
    <div className="space-y-4 mt-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">API Keys</h2>
          <p className="text-muted-foreground">
            Manage your authentication keys for model providers
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>Add API Key</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configured API Keys</CardTitle>
          <CardDescription>
            {apiKeys.length} key{apiKeys.length !== 1 ? 's' : ''} securely stored
          </CardDescription>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No API keys configured</p>
              <Button variant="outline" className="mt-4" onClick={() => setIsCreateModalOpen(true)}>
                Add your first key
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Key Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">
                      <Badge variant="outline">{key.provider}</Badge>
                    </TableCell>
                    <TableCell>{key.keyName}</TableCell>
                    <TableCell>
                      <Badge variant={key.isValid ? 'success' : 'destructive'}>
                        {key.isValid ? 'Valid' : 'Invalid'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this API Key?')) {
                            deleteMutation.mutate(key.id);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isCreateModalOpen && (
        <CreateApiKeyModal userId={user.id} onClose={() => setIsCreateModalOpen(false)} />
      )}
    </div>
  );
}
