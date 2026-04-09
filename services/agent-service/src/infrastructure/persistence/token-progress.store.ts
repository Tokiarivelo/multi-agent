import { Injectable } from '@nestjs/common';

export interface LiveTokenProgress {
  agentId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** Tool-call iteration count (0 = first LLM call, 1+ = after tool use) */
  iteration: number;
  startedAt: string; // ISO
  updatedAt: string; // ISO
}

/**
 * In-memory store for live token progress during active agent executions.
 * Keyed by agentId. Written by ExecuteAgentUseCase after each LLM call,
 * cleared on completion or failure. Read by the /token-usage/latest endpoint.
 *
 * Multi-tenant note: in the unlikely case two concurrent runs share the same
 * agentId the last writer wins — acceptable for polling UX.
 */
@Injectable()
export class TokenProgressStore {
  private readonly store = new Map<string, LiveTokenProgress>();

  set(agentId: string, progress: Omit<LiveTokenProgress, 'agentId'>): void {
    this.store.set(agentId, { agentId, ...progress });
  }

  get(agentId: string): LiveTokenProgress | undefined {
    return this.store.get(agentId);
  }

  clear(agentId: string): void {
    this.store.delete(agentId);
  }
}
