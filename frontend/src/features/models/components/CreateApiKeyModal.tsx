import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateApiKey } from '../hooks/useModels';
import { ModelProvider } from '@/types';

interface CreateApiKeyModalProps {
  userId: string;
  onClose: () => void;
}

export function CreateApiKeyModal({ userId, onClose }: CreateApiKeyModalProps) {
  const [provider, setProvider] = useState<string>(ModelProvider.OPENAI);
  const [keyName, setKeyName] = useState('');
  const [apiKey, setApiKey] = useState('');

  const createApiKeyMutation = useCreateApiKey();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createApiKeyMutation.mutate(
      { userId, provider, keyName, apiKey },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground shadow-lg border rounded-xl w-full max-w-md p-6 space-y-6">
        <div>
          <h3 className="text-xl font-semibold">Add API Key</h3>
          <p className="text-sm text-muted-foreground">Assign an API Key for a model provider.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="text-sm font-medium">Key Name</label>
            <Input
              required
              placeholder="e.g. My Personal OpenAI Key"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">API Key Value</label>
            <Input
              type="password"
              required
              placeholder="e.g. sk-proj-xxxxxxxx"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createApiKeyMutation.isPending}>
              {createApiKeyMutation.isPending ? 'Saving...' : 'Save API Key'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
