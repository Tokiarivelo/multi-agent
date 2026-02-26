"use client";

import { useAgent } from "@/features/agents/hooks/useAgents";
import { AgentForm } from "@/features/agents/components/AgentForm";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { use } from "react";

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: agent, isLoading, error } = useAgent(id);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-destructive">Error loading agent</div>;
  if (!agent) return <div>Agent not found</div>;

  return <AgentForm agent={agent} />;
}
