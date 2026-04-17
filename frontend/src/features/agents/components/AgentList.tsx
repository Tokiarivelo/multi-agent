'use client';

import { useState } from 'react';
import { useAgents, useCreateAgent } from '../hooks/useAgents';
import { useModels } from '@/features/models/hooks/useModels';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Edit, Bot, Wrench, Activity, Clock, Box, FileText, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { formatRelativeTime, getStatusColor } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { AgentAiGenerateModal } from './AgentAiGenerateModal';
import { GeneratedAgentConfig, ProvisionedTool } from '../api/agents.api';

export function AgentList() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useAgents();
  const { data: modelsData, isLoading: modelsLoading } = useModels();
  const createAgent = useCreateAgent();
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const handleAiApply = (config: GeneratedAgentConfig, modelId: string, provisionedTools?: ProvisionedTool[]) => {
    // config.tools already contains real DB IDs after backend provisioning
    // Use them directly; fall back to [] if provisioning didn't run
    const toolIds = provisionedTools ? provisionedTools.map((t) => t.id) : [];
    createAgent.mutate({
      name: config.name,
      description: config.description,
      modelId,
      systemPrompt: config.systemPrompt,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      tools: toolIds,
    });
  };

  if (isLoading || modelsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-muted/10 rounded-3xl border border-dashed border-border/60">
        <LoadingSpinner className="h-10 w-10 text-violet-500" />
        <p className="mt-4 text-sm font-medium text-muted-foreground animate-pulse">
          Loading...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-destructive/5 rounded-3xl border border-destructive/20 text-destructive">
         <p className="font-semibold">Error loading agents</p>
      </div>
    );
  }

  const agents = data?.data || [];
  const models = modelsData?.data || [];

  return (
    <>
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-end justify-between px-1">
        <div className="space-y-1">
          <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <Bot className="h-8 w-8 text-blue-500" />
            {t('agents.title')}
          </h2>
          <p className="text-muted-foreground font-medium pl-1">
            {t('agents.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-4">
           <Badge variant="secondary" className="font-mono px-3 py-1 text-sm bg-blue-500/10 text-blue-600 border-none shadow-none hidden sm:inline-flex">
            {agents.length} {t('agents.configured')}
          </Badge>
          <Button
            variant="outline"
            className="gap-2 border-blue-500/30 text-blue-600 hover:bg-blue-500/10 transition-all"
            onClick={() => setAiModalOpen(true)}
          >
            <Sparkles className="h-4 w-4" />
            Generate with AI
          </Button>
          <Link href="/agents/new">
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-blue-500/25 transition-all">
              <Plus className="h-4 w-4" />
              {t('agents.new')}
            </Button>
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden border-none shadow-2xl bg-card/60 backdrop-blur-md">
        <CardContent className="p-0">
          {agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
               <div className="p-4 rounded-full bg-blue-500/10 shadow-xs mb-4">
                <Bot className="h-10 w-10 text-blue-500/60" />
              </div>
              <h3 className="text-xl font-bold text-foreground/80">
                {t('agents.empty.title')}
              </h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-[300px]">
                {t('agents.empty.desc')}
              </p>
              <Link href="/agents/new" className="mt-6">
                <Button variant="outline" className="border-blue-500/30 text-blue-600 hover:bg-blue-500 hover:text-white transition-all">
                  {t('agents.new')}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-border/40">
                    <TableHead className="font-bold text-foreground py-4">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-muted-foreground" />
                        {t('agents.table.name')}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {t('agents.table.description')}
                      </div>
                    </TableHead>
                     <TableHead className="font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <Box className="h-4 w-4 text-muted-foreground" />
                        {t('agents.table.model')}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-foreground text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        {t('agents.table.tools')}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-foreground">
                       <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        {t('agents.table.status')}
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {t('agents.table.updated')}
                      </div>
                    </TableHead>
                    <TableHead className="text-right font-bold text-foreground pr-6">
                      {t('agents.table.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => (
                    <TableRow key={agent.id} className="group hover:bg-muted/40 transition-colors border-border/30">
                      <TableCell className="font-medium py-4">
                        <Link href={`/agents/${agent.id}`} className="hover:text-blue-500 transition-colors flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 font-bold text-xs ring-1 ring-blue-500/20 group-hover:scale-110 transition-transform">
                            {agent.name.slice(0, 2).toUpperCase()}
                          </div>
                          {agent.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {agent.description || '—'}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/models/${agent.modelId}`}
                          className="hover:underline text-blue-500 text-sm font-medium"
                        >
                          {models.find((m) => m.id === agent.modelId)?.name || agent.modelId.slice(0, 10) + '...'}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-mono bg-muted text-muted-foreground shadow-none border-border/50">
                          {agent.tools?.length || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getStatusColor(agent.status)}
                          className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 h-5"
                        >
                          {agent.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground">
                        {formatRelativeTime(agent.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Link href={`/agents/${agent.id}`}>
                          <Button variant="ghost" size="sm" className="gap-2 hover:bg-blue-500/10 hover:text-blue-600 transition-colors">
                            {t('agents.actions.edit')}
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>

    <AgentAiGenerateModal
      open={aiModalOpen}
      onOpenChange={setAiModalOpen}
      onApply={handleAiApply}
    />
    </>
  );
}
