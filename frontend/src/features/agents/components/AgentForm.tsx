'use client';

import { useState } from 'react';
import { useCreateAgent, useUpdateAgent, useDeleteAgent } from '../hooks/useAgents';
import { useModels } from '@/features/models/hooks/useModels';
import { Agent } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, ChevronLeft, Trash2 } from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import Link from 'next/link';

interface AgentFormProps {
  agent?: Agent;
}

export function AgentForm({ agent }: AgentFormProps) {
  const [name, setName] = useState(agent?.name || '');
  const [description, setDescription] = useState(agent?.description || '');
  const [modelId, setModelId] = useState(agent?.modelId || '');
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt || '');
  const [temperature, setTemperature] = useState(agent?.temperature?.toString() || '0.7');
  const [maxTokens, setMaxTokens] = useState(agent?.maxTokens?.toString() || '2048');

  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();
  const { data: modelsData, isLoading: modelsLoading } = useModels();

  const handleSave = () => {
    const agentData = {
      name,
      description,
      modelId,
      systemPrompt,
      temperature: parseFloat(temperature),
      maxTokens: parseInt(maxTokens),
      tools: agent?.tools || [],
    };

    if (agent?.id) {
      updateAgent.mutate({ id: agent.id, agent: agentData });
    } else {
      createAgent.mutate(agentData);
    }
  };

  const handleDelete = () => {
    if (agent?.id && window.confirm('Are you sure you want to delete this agent?')) {
      deleteAgent.mutate(agent.id);
    }
  };

  const isLoading = createAgent.isPending || updateAgent.isPending || deleteAgent.isPending;
  const models = modelsData?.data || [];

  if (modelsLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/agents">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h2 className="text-2xl font-bold">{agent ? 'Edit Agent' : 'New Agent'}</h2>
        </div>
        <div className="flex items-center gap-2">
          {agent && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
          <Button onClick={handleSave} disabled={isLoading} className="gap-2">
            <Save className="h-4 w-4" />
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agent Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Agent"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this agent do?"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="model" className="text-sm font-medium">
              Model
            </label>
            <select
              id="model"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            >
              <option value="">Select a model</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.provider})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="systemPrompt" className="text-sm font-medium">
              System Prompt
            </label>
            <Textarea
              id="systemPrompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant..."
              rows={5}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="temperature" className="text-sm font-medium">
                Temperature
              </label>
              <Input
                id="temperature"
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="maxTokens" className="text-sm font-medium">
                Max Tokens
              </label>
              <Input
                id="maxTokens"
                type="number"
                min="1"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
