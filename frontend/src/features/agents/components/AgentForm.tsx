'use client';

import { useState } from 'react';
import { useCreateAgent, useUpdateAgent, useDeleteAgent } from '../hooks/useAgents';
import { useModels } from '@/features/models/hooks/useModels';
import { useTools } from '@/features/tools/hooks/useTools';
import { Agent } from '@/types';
import { Button } from '@/components/ui/button';
import { Save, ChevronLeft, Trash2, Bot } from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { AgentGeneralInfo } from './AgentGeneralInfo';
import { AgentModelConfig } from './AgentModelConfig';
import { AgentToolsConfig } from './AgentToolsConfig';

interface AgentFormProps {
  agent?: Agent;
}

export function AgentForm({ agent }: AgentFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(agent?.name || '');
  const [description, setDescription] = useState(agent?.description || '');
  const [modelId, setModelId] = useState(agent?.modelId || '');
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt || '');
  const [temperature, setTemperature] = useState<number[]>(agent?.temperature !== undefined ? [agent.temperature] : [0.7]);
  const [maxTokens, setMaxTokens] = useState<number[]>(agent?.maxTokens !== undefined ? [agent.maxTokens] : [2048]);
  const [selectedTools, setSelectedTools] = useState<string[]>(agent?.tools || []);

  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();
  const { data: modelsData, isLoading: modelsLoading } = useModels();
  const { data: toolsData, isLoading: toolsLoading } = useTools();

  const handleSave = () => {
    const agentData = {
      name,
      description,
      modelId,
      systemPrompt,
      temperature: temperature[0],
      maxTokens: maxTokens[0],
      tools: selectedTools,
    };

    if (agent?.id) {
      updateAgent.mutate({ id: agent.id, agent: agentData });
    } else {
      createAgent.mutate(agentData);
    }
  };

  const handleDelete = () => {
    if (agent?.id && window.confirm(t('agents.form.delete_confirm'))) {
      deleteAgent.mutate(agent.id);
    }
  };

  const isLoading = createAgent.isPending || updateAgent.isPending || deleteAgent.isPending;
  const models = modelsData?.data || [];
  const availableTools = toolsData?.data || [];

  const toggleTool = (toolId: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId]
    );
  };

  if (modelsLoading || toolsLoading) return (
    <div className="flex flex-col items-center justify-center py-24 bg-muted/10 rounded-3xl border border-dashed border-border/60">
      <LoadingSpinner className="h-10 w-10 text-blue-500" />
      <p className="mt-4 text-sm font-medium text-muted-foreground animate-pulse">
        Loading...
      </p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto pb-12">
      <div className="flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-xl z-20 py-4 border-b border-border/40 -mx-4 px-4 sm:-mx-8 sm:px-8 mb-6">
        <div className="flex items-center gap-4">
          <Link href="/agents">
            <Button variant="outline" size="icon" className="h-9 w-9 border-border/50 hover:bg-muted/50 rounded-full">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <Bot className="h-6 w-6 text-blue-500" />
              {agent ? t('agents.form.edit_title') : t('agents.form.new_title')}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {agent && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
              className="gap-2 shadow-sm rounded-xl"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t('agents.actions.delete')}</span>
            </Button>
          )}
          <Button onClick={handleSave} disabled={isLoading} className="gap-2 shadow-md rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
            <Save className="h-4 w-4" />
            {isLoading ? t('agents.actions.saving') : t('agents.actions.save')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: General Info & Prompt */}
        <div className="lg:col-span-2 space-y-6">
          <AgentGeneralInfo
            name={name}
            setName={setName}
            description={description}
            setDescription={setDescription}
            systemPrompt={systemPrompt}
            setSystemPrompt={setSystemPrompt}
          />
        </div>

        {/* Right Column: Model Settings & Capabilities */}
        <div className="space-y-6">
          <AgentModelConfig
            modelId={modelId}
            setModelId={setModelId}
            temperature={temperature}
            setTemperature={setTemperature}
            maxTokens={maxTokens}
            setMaxTokens={setMaxTokens}
            models={models}
          />

          <AgentToolsConfig
            selectedTools={selectedTools}
            toggleTool={toggleTool}
            availableTools={availableTools}
          />
        </div>
      </div>
    </div>
  );
}
