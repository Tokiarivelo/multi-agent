import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateModel } from '../hooks/useModels';
import { ModelProvider } from '@/types';

interface CreateModelModalProps {
  onClose: () => void;
}

export function CreateModelModal({ onClose }: CreateModelModalProps) {
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<string>(ModelProvider.OPENAI);
  const [modelId, setModelId] = useState('');
  const [maxTokens, setMaxTokens] = useState<number>(4000);

  const createModelMutation = useCreateModel();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createModelMutation.mutate(
      { name, provider, modelId, maxTokens, supportsStreaming: true, isActive: true },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground shadow-lg border rounded-xl w-full max-w-md p-6 space-y-6">
        <div>
          <h3 className="text-xl font-semibold">Add New Model</h3>
          <p className="text-sm text-muted-foreground">
            Configure a language model for the agents.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Model Display Name</label>
            <Input
              required
              placeholder="e.g. GPT-4 Turbo"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Provider</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {Object.values(ModelProvider).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Model Engine ID</label>
            <Input
              required
              placeholder="e.g. gpt-4-turbo-preview"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Max Tokens</label>
            <Input
              type="number"
              required
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createModelMutation.isPending}>
              {createModelMutation.isPending ? 'Saving...' : 'Save Model'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
