import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../database/prisma.service';

// ─── Shared types ─────────────────────────────────────────────────────────────

export type HealingStrategy = 'AUTO_FIX' | 'MANUAL_APPROVAL' | 'LOG_ONLY';
export type HealingStatus = 'PENDING' | 'APPLIED' | 'REJECTED' | 'FAILED';
export type HealingFailureType = 'TECHNICAL' | 'FUNCTIONAL';

// ─── Technical failure (node crashed) ────────────────────────────────────────

export interface HealingErrorContext {
  executionId: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  nodeConfig: Record<string, unknown>;
  input: unknown;
  errorMessage: string;
  stackTrace?: string;
  retryCount: number;
}

export interface HealingSuggestion {
  errorCategory:
    | 'missing_param'
    | 'wrong_path'
    | 'tool_not_found'
    | 'timeout'
    | 'type_mismatch'
    | 'permission_denied'
    | 'other';
  explanation: string;
  fixSummary: string;
  fixedConfig: Record<string, unknown>;
  strategy: HealingStrategy;
  confidence: number;
}

// ─── Functional failure (workflow completed but task not accomplished) ─────────

export interface NodeOutput {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  output: unknown;
  status: string;
}

export interface FunctionalFailureContext {
  executionId: string;
  originalRequest: string; // execution.input as a readable string
  nodeOutputs: NodeOutput[]; // all node outputs in execution order
  finalOutput: unknown; // execution.output
}

export interface FunctionalFailureResult {
  isFunctionalFailure: boolean;
  confidence: number;
  failureReason: string;
  failedNodeId: string; // 'WORKFLOW' when it's the overall outcome
  failedNodeName: string;
  suggestedAction: string;
  fixedConfig: Record<string, unknown>;
  strategy: HealingStrategy;
}

// ─── Heuristic failure indicators (EN + FR) ───────────────────────────────────

const FUNCTIONAL_FAILURE_PATTERNS: RegExp[] = [
  // File / resource not found
  /does not exist/i,
  /not found/i,
  /n['''`]?existe pas/i,
  /introuvable/i,
  /unable to (find|access|read|open|load|locate)/i,
  /cannot (find|access|read|open|load|locate)/i,
  /could not (find|access|read|open|load|locate)/i,
  /no (file|document|pdf|data|content) (found|available|provided|detected)/i,
  /aucun (fichier|document|pdf|contenu|données)\s/i,
  /le fichier.{0,30}n['''`]?existe/i,
  /file.{0,20}not.{0,10}found/i,

  // Agent apologies / refusals
  /i (am|'m) (sorry|unable|not able)/i,
  /je (suis désolé|ne peux pas|n['''`]?arrive pas)/i,
  /je n['''`]?ai pas (pu|réussi|trouvé)/i,
  /désolé.{0,30}ne peut pas/i,
  /unfortunately[,\s]/i,
  /malheureusement/i,
  /i['']?m afraid/i,
  /je regrette/i,

  // Asking user to supply what they already provided
  /please provide/i,
  /veuillez (fournir|préciser|indiquer|spécifier)/i,
  /merci de (fournir|préciser)/i,
  /could you (please )?provide/i,
  /pouvez-vous (me )?fournir/i,

  // Permission / access
  /permission denied/i,
  /access denied/i,
  /accès refusé/i,
  /unauthorized/i,
  /non autorisé/i,
];

// Minimum fraction of suspicious patterns to skip LLM and immediately flag
const HEURISTIC_CONFIDENCE_THRESHOLD = 2; // number of matching patterns

// ─── System prompts ───────────────────────────────────────────────────────────

const TECHNICAL_SYSTEM_PROMPT = `You are an expert workflow debugger for a multi-agent automation platform.
Your task is to analyze why a workflow node failed and suggest a precise configuration fix.

A workflow node has:
- type: one of START, END, AGENT, TOOL, PROMPT, TEXT, CONDITIONAL, TRANSFORM, LOOP, SHELL, WORKSPACE_READ, WORKSPACE_WRITE, SUBWORKFLOW
- config: type-specific configuration object
- input: data passed into the node at runtime

Common error categories and fixes:
1. missing_param: A required config field is absent → add the missing field with a sensible default or inferred value
2. wrong_path: A file/workspace path is incorrect or relative → correct to an absolute path
3. tool_not_found: The toolId or toolName doesn't exist → suggest a valid tool name or correct the reference
4. timeout: Execution exceeded the time limit → suggest increasing timeout or simplifying the operation
5. type_mismatch: Input/output type is wrong → fix the config to match the expected type or add a transform
6. permission_denied: Access denied to a resource → suggest adjusting path or permissions config
7. other: Catch-all for errors not matching the above categories

IMPORTANT rules:
- Return ONLY the fixedConfig fields that need to change, not the full config (merge with existing)
- Set confidence between 0.0 and 1.0 (>0.7 for clear fixes, <0.5 for uncertain suggestions)
- Set strategy to "AUTO_FIX" only if confidence >= 0.75 and the change is safe (no data loss risk)
- Set strategy to "MANUAL_APPROVAL" if the fix is structural or needs human review
- Set strategy to "LOG_ONLY" if you cannot determine a safe fix

Respond ONLY with valid JSON — no markdown fences, no prose. Pure JSON only.

Response schema:
{
  "errorCategory": "missing_param" | "wrong_path" | "tool_not_found" | "timeout" | "type_mismatch" | "permission_denied" | "other",
  "explanation": "Clear explanation of why the node failed",
  "fixSummary": "One-line description of the fix applied",
  "fixedConfig": { ...only changed config fields... },
  "strategy": "AUTO_FIX" | "MANUAL_APPROVAL" | "LOG_ONLY",
  "confidence": 0.0
}`;

const FUNCTIONAL_SYSTEM_PROMPT = `You are an AI quality controller for a multi-agent automation platform.
Your task is to determine if a workflow actually accomplished the user's intended task.

CRITICAL OUTPUT RULES:
1. You MUST respond with ONLY valid JSON. Nothing else.
2. Do NOT wrap the JSON in markdown code blocks (no \`\`\`json or \`\`\`).
3. Do NOT add any explanation, preamble, or text before or after the JSON.
4. Your entire response must be parseable by JSON.parse().

WHAT TO DETECT — focus on the OUTCOME, not the execution status.
A workflow is functionally FAILED if any node:
- Could not find the requested resource (file, PDF, data, etc.)
- Returned an apology, refusal, or "I cannot do this" message
- Asked for information that should already have been provided
- Returned empty, meaningless, or placeholder content
- Produced output that does not address the user's request

Signs the task WAS accomplished:
- The output directly answers or fulfills the user's request
- The agent performed the requested action
- The response contains actual content, not an error or apology

FIX GUIDANCE — When suggesting a fixedConfig:
- You may suggest changes to any node config fields.
- To update the tools available to an AGENT node, set "toolIds" to an array of tool IDs in fixedConfig.
- Only include fields that actually need to change.
- If the workflow is missing a required step or node, mention that a new node should be added in the "suggestedAction" field (do not try to create a new node in fixedConfig).

EXAMPLE of valid response when task failed:
{"isFunctionalFailure":true,"confidence":0.9,"failureReason":"Agent could not find the requested PDF file","failedNodeId":"node-abc","failedNodeName":"File Reader","suggestedAction":"Check that the file path is correct and the file exists","fixedConfig":{},"strategy":"MANUAL_APPROVAL"}

EXAMPLE of valid response when task succeeded:
{"isFunctionalFailure":false,"confidence":0.95,"failureReason":"Task accomplished successfully","failedNodeId":"WORKFLOW","failedNodeName":"Workflow","suggestedAction":"","fixedConfig":{},"strategy":"LOG_ONLY"}

Required JSON fields (no extra fields, no omissions):
- isFunctionalFailure: boolean
- confidence: number between 0 and 1
- failureReason: string
- failedNodeId: string (node id or "WORKFLOW")
- failedNodeName: string
- suggestedAction: string
- fixedConfig: object (empty {} if no fix; may include "toolIds" array for AGENT nodes)
- strategy: one of "AUTO_FIX", "MANUAL_APPROVAL", "LOG_ONLY"`;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class WorkflowHealingService {
  private readonly logger = new Logger(WorkflowHealingService.name);
  private readonly agentServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.agentServiceUrl = this.configService.get<string>('AGENT_SERVICE_URL')!;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TECHNICAL FAILURE (node crashed)
  // ══════════════════════════════════════════════════════════════════════════

  async analyzeError(
    context: HealingErrorContext,
    modelId: string,
    userId: string,
  ): Promise<HealingSuggestion> {
    const userMessage = this.buildTechnicalPrompt(context);

    let raw: string;
    try {
      const response = await this.callCompletion(
        modelId,
        TECHNICAL_SYSTEM_PROMPT,
        [{ role: 'user', content: userMessage }],
        userId,
      );
      raw = response.content;
    } catch (err) {
      this.logger.error(
        `Technical healing AI call failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return this.fallbackTechnicalSuggestion(context);
    }

    const suggestion = this.parseTechnicalResponse(raw, context);
    this.logger.log(
      `[TECHNICAL] node=${context.nodeId} category=${suggestion.errorCategory} ` +
        `strategy=${suggestion.strategy} confidence=${suggestion.confidence}`,
    );
    return suggestion;
  }

  async saveHealingLog(
    context: HealingErrorContext,
    suggestion: HealingSuggestion,
    status: HealingStatus = 'PENDING',
  ): Promise<string> {
    const log = await this.prisma.workflowHealingLog.create({
      data: {
        executionId: context.executionId,
        nodeId: context.nodeId,
        nodeName: context.nodeName,
        nodeType: context.nodeType,
        errorMessage: context.errorMessage,
        errorContext: JSON.parse(JSON.stringify(context)),
        suggestion: JSON.parse(JSON.stringify(suggestion)),
        failureType: 'TECHNICAL',
        strategy: suggestion.strategy,
        status,
      },
    });
    return log.id;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FUNCTIONAL FAILURE (completed but task not accomplished)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Two-phase detection:
   * 1. Fast heuristic keyword scan — no LLM cost
   * 2. LLM confirmation — only when heuristic fires OR forceLlm=true OR customPrompt provided
   */
  async detectFunctionalFailure(
    ctx: FunctionalFailureContext,
    modelId: string,
    userId: string,
    forceLlm = false,
    customPrompt?: string,
    currentTools?: string[],
    availableTools?: { id: string; name: string }[],
  ): Promise<FunctionalFailureResult> {
    const heuristicResult = this.runHeuristicScan(ctx.nodeOutputs, ctx.finalOutput);

    this.logger.debug(
      `[FUNCTIONAL] executionId=${ctx.executionId} heuristicMatches=${heuristicResult.matchCount} ` +
        `suspiciousNode=${heuristicResult.suspiciousNodeId ?? 'none'}`,
    );

    // A custom prompt always forces LLM analysis
    const shouldCallLlm =
      forceLlm || !!customPrompt || heuristicResult.matchCount >= HEURISTIC_CONFIDENCE_THRESHOLD;

    // Skip LLM if heuristic finds nothing, no custom prompt, and forceLlm is off
    if (!shouldCallLlm) {
      return {
        isFunctionalFailure: false,
        confidence: 0,
        failureReason: 'No functional failure indicators detected',
        failedNodeId: 'WORKFLOW',
        failedNodeName: 'Workflow',
        suggestedAction: '',
        fixedConfig: {},
        strategy: 'LOG_ONLY',
      };
    }

    // LLM analysis
    const userMessage = this.buildFunctionalPrompt(
      ctx,
      heuristicResult,
      customPrompt,
      currentTools,
      availableTools,
    );

    let raw: string;
    try {
      const response = await this.callCompletion(
        modelId,
        FUNCTIONAL_SYSTEM_PROMPT,
        [{ role: 'user', content: userMessage }],
        userId,
        1024,
      );
      raw = response.content;
    } catch (err) {
      this.logger.error(
        `Functional healing AI call failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Fallback: trust the heuristic if LLM fails
      return this.fallbackFunctionalResult(ctx, heuristicResult);
    }

    const result = this.parseFunctionalResponse(raw);
    this.logger.log(
      `[FUNCTIONAL] executionId=${ctx.executionId} isFailed=${result.isFunctionalFailure} ` +
        `confidence=${result.confidence} strategy=${result.strategy}`,
    );
    return result;
  }

  async saveFunctionalFailureLog(
    ctx: FunctionalFailureContext,
    result: FunctionalFailureResult,
    status: HealingStatus = 'PENDING',
    isTest = false,
  ): Promise<string> {
    const suggestion: Record<string, unknown> = {
      explanation: result.failureReason,
      fixSummary: result.suggestedAction,
      fixedConfig: result.fixedConfig,
      strategy: result.strategy,
      confidence: result.confidence,
      suggestedAction: result.suggestedAction,
    };

    const log = await this.prisma.workflowHealingLog.create({
      data: {
        executionId: ctx.executionId,
        nodeId: result.failedNodeId,
        nodeName: result.failedNodeName,
        nodeType: 'FUNCTIONAL_CHECK',
        errorMessage: result.failureReason,
        errorContext: JSON.parse(
          JSON.stringify({ ...ctx, nodeOutputs: ctx.nodeOutputs.slice(0, 10) }),
        ),
        suggestion: JSON.parse(JSON.stringify(suggestion)),
        failureType: 'FUNCTIONAL',
        strategy: result.strategy,
        status,
        isTest,
      },
    });
    return log.id;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SHARED
  // ══════════════════════════════════════════════════════════════════════════

  async updateHealingLogStatus(logId: string, status: HealingStatus): Promise<void> {
    await this.prisma.workflowHealingLog.update({
      where: { id: logId },
      data: {
        status,
        appliedAt: status === 'APPLIED' ? new Date() : undefined,
        updatedAt: new Date(),
      },
    });
  }

  async getHealingLogs(executionId: string) {
    return this.prisma.workflowHealingLog.findMany({
      where: { executionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  // ─── Heuristic scan ───────────────────────────────────────────────────────

  private runHeuristicScan(
    nodeOutputs: NodeOutput[],
    finalOutput: unknown,
  ): {
    matchCount: number;
    suspiciousNodeId: string | null;
    suspiciousNodeName: string;
    matchedTexts: string[];
  } {
    const matchedTexts: string[] = [];
    let suspiciousNodeId: string | null = null;
    let suspiciousNodeName = 'Workflow';

    const scanText = (text: string, nodeId: string, nodeName: string) => {
      for (const pattern of FUNCTIONAL_FAILURE_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
          matchedTexts.push(`[${nodeName}] matched "${match[0]}" in: "${text.slice(0, 120)}"`);
          if (!suspiciousNodeId) {
            suspiciousNodeId = nodeId;
            suspiciousNodeName = nodeName;
          }
        }
      }
    };

    // Scan each node output
    for (const node of nodeOutputs) {
      const text = this.extractText(node.output);
      if (text) scanText(text, node.nodeId, node.nodeName);
    }

    // Also scan final output
    if (finalOutput) {
      const text = this.extractText(finalOutput);
      if (text) scanText(text, 'WORKFLOW', 'Final output');
    }

    return { matchCount: matchedTexts.length, suspiciousNodeId, suspiciousNodeName, matchedTexts };
  }

  private extractText(value: unknown, depth = 0): string {
    if (depth > 5) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return value.map((v) => this.extractText(v, depth + 1)).join(' ');
      }
      return Object.values(value as Record<string, unknown>)
        .map((v) => this.extractText(v, depth + 1))
        .join(' ');
    }
    return '';
  }

  // ─── Prompt builders ──────────────────────────────────────────────────────

  private buildTechnicalPrompt(context: HealingErrorContext): string {
    return (
      `Analyze this workflow node failure and suggest a fix.\n\n` +
      `Node Type: ${context.nodeType}\n` +
      `Node Name: ${context.nodeName}\n` +
      `Node ID: ${context.nodeId}\n` +
      `Retry Count: ${context.retryCount}\n\n` +
      `Current Node Config:\n${JSON.stringify(context.nodeConfig, null, 2)}\n\n` +
      `Input Data:\n${JSON.stringify(context.input, null, 2)}\n\n` +
      `Error Message:\n${context.errorMessage}\n` +
      (context.stackTrace
        ? `\nStack Trace (first 500 chars):\n${context.stackTrace.slice(0, 500)}\n`
        : '')
    );
  }

  private buildFunctionalPrompt(
    ctx: FunctionalFailureContext,
    heuristic: ReturnType<WorkflowHealingService['runHeuristicScan']>,
    customPrompt?: string,
    currentTools?: string[],
    availableTools?: { id: string; name: string }[],
  ): string {
    const outputLines = ctx.nodeOutputs.map((n, i) => {
      const text = this.extractText(n.output).slice(0, 500);
      return `[${i + 1}] ${n.nodeType} "${n.nodeName}" (${n.nodeId}) → "${text}"`;
    });

    let toolContext = '';
    if (availableTools && availableTools.length > 0) {
      toolContext += `\n\nAvailable Tools:\n${availableTools.map((t) => `- [${t.id}] ${t.name}`).join('\n')}\n`;
      if (currentTools) {
        toolContext += `Current Tool IDs on node: ${currentTools.length > 0 ? currentTools.join(', ') : 'None'}\n`;
      }
    }

    return (
      `Determine if this workflow actually accomplished the user's task.\n\n` +
      `User's original request:\n"${ctx.originalRequest}"\n\n` +
      `Workflow node outputs (in execution order):\n${outputLines.join('\n')}\n\n` +
      `Final workflow output:\n${JSON.stringify(ctx.finalOutput, null, 2).slice(0, 800)}\n\n` +
      (heuristic.matchCount > 0
        ? `⚠ Heuristic pre-scan flagged ${heuristic.matchCount} suspicious indicator(s):\n` +
          heuristic.matchedTexts
            .slice(0, 5)
            .map((t) => `  - ${t}`)
            .join('\n') +
          '\n\n'
        : '') +
      (customPrompt
        ? `Additional analysis instructions from the user:\n"${customPrompt}"\n\n`
        : '') +
      toolContext +
      `Based on this analysis, determine whether the task was actually accomplished.`
    );
  }

  // ─── Response parsers ─────────────────────────────────────────────────────

  private parseTechnicalResponse(raw: string, context: HealingErrorContext): HealingSuggestion {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();

    try {
      const parsed = JSON.parse(cleaned) as Partial<HealingSuggestion>;
      return {
        errorCategory: parsed.errorCategory ?? 'other',
        explanation: parsed.explanation ?? 'Unable to determine root cause',
        fixSummary: parsed.fixSummary ?? 'No fix available',
        fixedConfig: parsed.fixedConfig ?? {},
        strategy: parsed.strategy ?? 'LOG_ONLY',
        confidence:
          typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0,
      };
    } catch {
      this.logger.warn(`Could not parse technical healing response for node ${context.nodeId}`);
      return this.fallbackTechnicalSuggestion(context);
    }
  }

  private parseFunctionalResponse(raw: string): FunctionalFailureResult {
    const attempt = (text: string): FunctionalFailureResult | null => {
      try {
        const parsed = JSON.parse(text) as Partial<FunctionalFailureResult>;
        return {
          isFunctionalFailure: parsed.isFunctionalFailure ?? false,
          confidence:
            typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0,
          failureReason: parsed.failureReason ?? '',
          failedNodeId: parsed.failedNodeId ?? 'WORKFLOW',
          failedNodeName: parsed.failedNodeName ?? 'Workflow',
          suggestedAction: parsed.suggestedAction ?? '',
          fixedConfig: (parsed.fixedConfig as Record<string, unknown>) ?? {},
          strategy: parsed.strategy ?? 'MANUAL_APPROVAL',
        };
      } catch {
        return null;
      }
    };

    // 1. Try raw response directly
    const direct = attempt(raw.trim());
    if (direct) return direct;

    // 2. Strip markdown code fences (```json ... ``` or ``` ... ```)
    const stripped = raw
      .replace(/^```(?:json)?\s*/im, '')
      .replace(/\s*```\s*$/m, '')
      .trim();
    const fromStripped = attempt(stripped);
    if (fromStripped) return fromStripped;

    // 3. Extract first {...} block (handles prose wrapping JSON)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const fromMatch = attempt(jsonMatch[0]);
      if (fromMatch) return fromMatch;
    }

    this.logger.warn(
      `Could not parse functional failure response. Raw (first 300 chars): ${raw.slice(0, 300)}`,
    );
    return {
      isFunctionalFailure: false,
      confidence: 0,
      failureReason: 'Parse error — manual review required',
      failedNodeId: 'WORKFLOW',
      failedNodeName: 'Workflow',
      suggestedAction: '',
      fixedConfig: {},
      strategy: 'LOG_ONLY',
    };
  }

  // ─── Fallbacks ────────────────────────────────────────────────────────────

  private fallbackTechnicalSuggestion(context: HealingErrorContext): HealingSuggestion {
    return {
      errorCategory: 'other',
      explanation: `Node "${context.nodeName}" failed with: ${context.errorMessage}`,
      fixSummary: 'Manual inspection required — AI analysis unavailable',
      fixedConfig: {},
      strategy: 'LOG_ONLY',
      confidence: 0,
    };
  }

  private fallbackFunctionalResult(
    _ctx: FunctionalFailureContext,
    heuristic: ReturnType<WorkflowHealingService['runHeuristicScan']>,
  ): FunctionalFailureResult {
    return {
      isFunctionalFailure: heuristic.matchCount >= HEURISTIC_CONFIDENCE_THRESHOLD,
      confidence: Math.min(0.6, heuristic.matchCount * 0.15),
      failureReason: `Heuristic detected ${heuristic.matchCount} failure indicator(s) — LLM analysis unavailable`,
      failedNodeId: heuristic.suspiciousNodeId ?? 'WORKFLOW',
      failedNodeName: heuristic.suspiciousNodeName,
      suggestedAction: 'Review the workflow output manually',
      fixedConfig: {},
      strategy: 'LOG_ONLY',
    };
  }

  // ─── LLM call ─────────────────────────────────────────────────────────────

  private async callCompletion(
    modelId: string,
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    userId?: string,
    maxTokens?: number,
  ): Promise<{ content: string }> {
    const { data } = await firstValueFrom(
      this.httpService.post(`${this.agentServiceUrl}/api/completions`, {
        modelId,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        userId,
        ...(maxTokens ? { maxTokens } : {}),
      }),
    );
    return data as { content: string };
  }
}
