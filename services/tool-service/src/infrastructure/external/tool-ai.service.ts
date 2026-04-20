import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';

export interface ToolAiMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface GeneratedToolConfig {
  name: string;
  description: string;
  category: 'WEB' | 'API' | 'DATABASE' | 'FILE' | 'CUSTOM' | 'MCP';
  parameters: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description: string;
    required: boolean;
    default?: unknown;
  }>;
  code: string;
  icon: string;
}

export interface ToolAiResult {
  sessionId: string;
  message: string;
  config?: GeneratedToolConfig;
  history: ToolAiMessage[];
}

interface ToolAiSession {
  id: string;
  modelId: string;
  messages: ToolAiMessage[];
  createdAt: string;
  updatedAt: string;
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const TOOL_SYSTEM_PROMPT = `You are a tool designer. Respond with ONLY a single valid JSON object — no markdown, no prose.

RULES:
1. Response = one JSON object from { to }
2. In "code": newlines → \\n, double-quotes → \\"  (never literal line breaks)
3. No trailing commas, no comments
4. DO NOT wrap the configuration inside a "config" object. Return ONLY the flat structure with name, description, category, parameters, code, and icon at the root level.
5. DO NOT include a "message" field.

Schema: {"name":"...","description":"...","category":"API","parameters":[{"name":"...","type":"string","description":"...","required":true}],"code":"async function execute(params) {\\n  ...\\n}","icon":"Cloud"}

Categories: WEB | API | DATABASE | FILE | CUSTOM | MCP
Types: string | number | boolean | object | array
Icons: Globe, Link, Database, FileText, Cloud, Zap, Search, Code, Wrench, Mail

Code rules: use params.x for inputs, fetch() for HTTP, return {result:...} or {error:msg}, wrap in try/catch.

EXAMPLE:
{"name":"Weather Fetcher","description":"Gets current weather via Open-Meteo (no API key)","category":"API","parameters":[{"name":"city","type":"string","description":"City name","required":true}],"code":"async function execute(params) {\\n  try {\\n    const g = await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(params.city)+'&count=1').then(r=>r.json());\\n    if (!g.results?.length) return {error:'City not found'};\\n    const {latitude,longitude} = g.results[0];\\n    const w = await fetch('https://api.open-meteo.com/v1/forecast?latitude='+latitude+'&longitude='+longitude+'&current_weather=true').then(r=>r.json());\\n    return {city:params.city,temperature:w.current_weather.temperature,windspeed:w.current_weather.windspeed};\\n  } catch(e) {return {error:e.message};}\\n}","icon":"Cloud"}

Output JSON only:`;

const VALID_CATEGORIES = new Set(['WEB', 'API', 'DATABASE', 'FILE', 'CUSTOM', 'MCP']);

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ToolAiService {
  private readonly logger = new Logger(ToolAiService.name);
  private readonly sessions = new Map<string, ToolAiSession>();
  private readonly agentServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.agentServiceUrl = this.configService.get<string>(
      'AGENT_SERVICE_URL',
      'http://localhost:3002',
    );
  }

  async generateTool(opts: {
    prompt: string;
    modelId: string;
    sessionId?: string;
  }): Promise<ToolAiResult> {
    const session = this.getOrCreateSession(opts.sessionId, opts.modelId);

    session.messages.push({
      role: 'user',
      content: opts.prompt,
      timestamp: new Date().toISOString(),
    });

    const apiMessages = [
      { role: 'system', content: TOOL_SYSTEM_PROMPT },
      ...session.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const response = await this.callCompletion(opts.modelId, apiMessages, 4096);

    this.logger.debug(
      `LLM raw response — length: ${response.content.length} chars, ` +
      `starts: ${JSON.stringify(response.content.slice(0, 120))}, ` +
      `ends: ${JSON.stringify(response.content.slice(-80))}`,
    );

    const { parsed, raw, error } = this.parseAndValidate(response.content);

    if (error) {
      this.logger.warn(`Tool generation parse/validation failed: ${error}`);
      this.logger.warn(`Full raw response (${response.content.length} chars): ${response.content}`);
    }

    session.messages.push({
      role: 'assistant',
      content: raw,
      timestamp: new Date().toISOString(),
    });
    session.updatedAt = new Date().toISOString();

    return {
      sessionId: session.id,
      message: parsed?.message ?? (error ? `Parse error: ${error}` : 'Tool configuration generated successfully'),
      config: parsed?.config,
      history: session.messages,
    };
  }

  getSession(sessionId: string): ToolAiSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  // ─── Parsing pipeline ──────────────────────────────────────────────────────

  private parseAndValidate(raw: string): {
    parsed: { message?: string; config?: GeneratedToolConfig } | null;
    raw: string;
    error?: string;
  } {
    // Try strategies in order of preference
    const candidates = this.extractJsonCandidates(raw);

    for (const candidate of candidates) {
      try {
        const obj = JSON.parse(candidate) as Record<string, unknown>;
        const normalized = this.normalizeResponse(this.flattenIfNested(obj));
        if (normalized) {
          return { parsed: normalized, raw: candidate };
        }
        this.logger.debug(`Candidate parsed but could not be normalized to a tool config`);
      } catch {
        // try next candidate
      }
    }

    // Last resort: try to repair unescaped newlines in code strings then re-run
    const repaired = this.repairCodeNewlines(raw);
    if (repaired !== raw) {
      for (const candidate of this.extractJsonCandidates(repaired)) {
        try {
          const obj = JSON.parse(candidate) as Record<string, unknown>;
          const normalized = this.normalizeResponse(this.flattenIfNested(obj));
          if (normalized) {
            return { parsed: normalized, raw: candidate };
          }
        } catch {
          // continue
        }
      }
    }

    return { parsed: null, raw, error: 'Could not extract valid JSON from LLM response' };
  }

  /**
   * Returns candidate JSON strings to try parsing, from most to least strict.
   */
  private extractJsonCandidates(raw: string): string[] {
    const candidates: string[] = [];

    // 1. Strip single code fence (most common LLM wrapping)
    const fenceStripped = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    candidates.push(fenceStripped);

    // 2. Extract content inside any code block: ```...```
    const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeBlockMatch) candidates.push(codeBlockMatch[1].trim());

    // 3. Find the outermost { ... } in the raw text (handles surrounding prose)
    const outermost = this.extractOutermostObject(raw);
    if (outermost) candidates.push(outermost);

    // 4. Same but from fence-stripped text
    const outermostFenced = this.extractOutermostObject(fenceStripped);
    if (outermostFenced && outermostFenced !== outermost) candidates.push(outermostFenced);

    // 5. Complete truncated JSON — handles the case where the LLM stops just
    //    before the final closing brace(s) (e.g. outer `}` missing after inner config closes)
    const completed = this.completeTruncatedJson(raw.trim());
    if (completed !== raw.trim()) candidates.push(completed);

    const completedFenced = this.completeTruncatedJson(fenceStripped);
    if (completedFenced !== fenceStripped) candidates.push(completedFenced);

    // Deduplicate while preserving order
    return [...new Set(candidates)].filter(Boolean);
  }

  /**
   * Closes any unclosed `{` or `[` brackets at the end of a truncated JSON
   * string. Only acts when the text ends outside a string literal.
   */
  private completeTruncatedJson(text: string): string {
    const stack: ('{' | '[')[] = [];
    let inString = false;
    let escape = false;

    for (const ch of text) {
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{' || ch === '[') stack.push(ch as '{' | '[');
      if (ch === '}' || ch === ']') stack.pop();
    }

    // If truncated inside a string we cannot safely complete it
    if (inString || stack.length === 0) return text;

    const closers = stack.reverse().map((c) => (c === '{' ? '}' : ']'));
    return text + closers.join('');
  }

  /**
   * Walks through the text character-by-character to find the outermost
   * balanced {...} block, correctly handling strings and escape sequences.
   */
  private extractOutermostObject(text: string): string | null {
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    return null;
  }

  /**
   * Attempts to escape literal newlines that appear inside JSON string values.
   * Only fixes the most common case (unescaped newlines in code field).
   */
  private repairCodeNewlines(raw: string): string {
    // Match "code": "...<possibly multiline>..."
    // and escape literal newlines/tabs inside the value
    return raw.replace(
      /("code"\s*:\s*")([\s\S]*?)("(?:\s*[,}]))/g,
      (_match, prefix, value, suffix) => {
        const escaped = value
          .replace(/\r\n/g, '\\n')
          .replace(/\r/g, '\\n')
          .replace(/\n/g, '\\n')
          .replace(/\t/g, '\\t');
        return `${prefix}${escaped}${suffix}`;
      },
    );
  }

  /**
   * If the LLM returned a nested { ..., config: { ... } } shape, promote the
   * config fields to the root level. Root-level name/description win when longer.
   */
  private flattenIfNested(obj: Record<string, unknown>): Record<string, unknown> {
    if (!obj.config || typeof obj.config !== 'object') return obj;
    const cfg = obj.config as Record<string, unknown>;
    const rootName = String(obj.name ?? '').trim();
    const cfgName = String(cfg.name ?? '').trim();
    const rootDesc = String(obj.description ?? '').trim();
    const cfgDesc = String(cfg.description ?? '').trim();
    return {
      ...cfg,
      name: cfgName.length >= rootName.length ? cfgName : rootName,
      description: cfgDesc.length >= rootDesc.length ? cfgDesc : rootDesc,
    };
  }

  /**
   * Accepts both shapes the LLM may return:
   *   Nested: { name, message, config: { name, category, parameters, code, ... } }
   *   Flat:   { name, category, parameters, code, ... }
   * Also normalises category to uppercase so "web" → "WEB" passes validation.
   */
  private normalizeResponse(
    obj: Record<string, unknown>,
  ): { message?: string; config?: GeneratedToolConfig } | null {
    // Resolve where the tool fields live: prefer the nested config, fall back to the root object
    const src =
      obj.config && typeof obj.config === 'object'
        ? (obj.config as Record<string, unknown>)
        : obj;

    const category = String(src.category ?? '').toUpperCase();
    if (!VALID_CATEGORIES.has(category)) return null;

    const name = String(src.name ?? obj.name ?? '').trim();
    const description = String(src.description ?? obj.description ?? '').trim();
    const code = String(src.code ?? '').trim();
    const parameters = Array.isArray(src.parameters) ? src.parameters : [];

    if (!name || !code) return null;

    return {
      message: typeof obj.message === 'string' ? obj.message : undefined,
      config: {
        name,
        description,
        category: category as GeneratedToolConfig['category'],
        parameters,
        code,
        icon: String(src.icon ?? 'Wrench'),
      },
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private getOrCreateSession(sessionId: string | undefined, modelId: string): ToolAiSession {
    if (sessionId) {
      const existing = this.sessions.get(sessionId);
      if (existing) return existing;
    }
    const id = sessionId ?? randomUUID();
    const session: ToolAiSession = {
      id,
      modelId,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(id, session);
    return session;
  }

  private async callCompletion(
    modelId: string,
    messages: Array<{ role: string; content: string }>,
    maxTokens = 4096,
  ): Promise<{ content: string }> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post(`${this.agentServiceUrl}/api/completions`, {
          modelId,
          messages,
          maxTokens,
        }),
      );
      return data as { content: string };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Completion call failed: ${msg}`);
      throw new Error(`AI completion failed: ${msg}`);
    }
  }
}
