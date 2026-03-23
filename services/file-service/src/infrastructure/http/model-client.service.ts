import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type LlmProvider = 'OPENAI' | 'GOOGLE' | 'OLLAMA' | 'AZURE' | 'CUSTOM';

export interface LlmModelConfig {
  provider: LlmProvider;
  modelId: string;
  apiKey: string;
  baseUrl?: string;
}

@Injectable()
export class ModelClientService {
  private readonly logger = new Logger(ModelClientService.name);
  private readonly modelServiceUrl: string;
  private readonly internalSecret: string;

  constructor(private readonly config: ConfigService) {
    this.modelServiceUrl = this.config.get<string>('MODEL_SERVICE_URL', 'http://localhost:3005');
    this.internalSecret = this.config.get<string>(
      'INTERNAL_SECRET',
      'fallback_internal_secret_for_dev_mode',
    );
  }

  /**
   * Resolve the full LLM config for summarization/extraction.
   */
  async resolveLlmConfig(
    modelId: string | null,
    apiKeyId: string | null,
  ): Promise<LlmModelConfig | null> {
    if (!modelId) return null;

    let model: { provider: string; modelId?: string; modelName?: string; baseUrl?: string };
    try {
      const res = await fetch(`${this.modelServiceUrl}/api/models/${modelId}`);
      if (!res.ok) throw new Error(`model-service returned ${res.status}`);
      model = await res.json();
    } catch (err) {
      this.logger.warn(`Failed to fetch model ${modelId}: ${err}. Cannot summarize.`);
      return null;
    }

    const providerModelId: string = model.modelId ?? model.modelName ?? '';

    let apiKey = '';
    if (apiKeyId) {
      try {
        const keyRes = await fetch(`${this.modelServiceUrl}/api-keys/${apiKeyId}/decrypt`, {
          headers: { 'x-internal-secret': this.internalSecret },
        });
        if (keyRes.ok) {
          const keyData = (await keyRes.json()) as { key: string };
          apiKey = keyData.key;
        } else {
          this.logger.warn(`Could not decrypt apiKey ${apiKeyId} (${keyRes.status})`);
        }
      } catch (err) {
        this.logger.warn(`API key decrypt failed: ${err}`);
      }
    }

    return {
      provider: model.provider as LlmProvider,
      modelId: providerModelId,
      apiKey,
      baseUrl: model.baseUrl,
    };
  }

  async summarizeChunk(text: string, config: LlmModelConfig): Promise<string> {
    const prompt = `You are an expert at information extraction and summarization for RAG (Retrieval-Augmented Generation) systems.
Analyze the following text chunk. Extract the most pertinent wordkeys and provide a dense, concise summary that minimizes token length without losing critical information or context. 
Your output should help an AI agent easily index and retrieve this document.

TEXT:
${text}

output only the summary and keywords.`;

    try {
      if (config.provider === 'OPENAI' || config.provider === 'AZURE') {
        const clientUrl = config.baseUrl
          ? config.provider === 'AZURE'
            ? `${config.baseUrl}/deployments/${config.modelId}/chat/completions?api-version=2024-02-01`
            : `${config.baseUrl}/v1/chat/completions`
          : 'https://api.openai.com/v1/chat/completions';

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (config.provider === 'AZURE') {
          headers['api-key'] = config.apiKey;
        } else {
          headers['Authorization'] = `Bearer ${config.apiKey}`;
        }

        const res = await fetch(clientUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: config.modelId,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 500,
          }),
        });

        if (!res.ok) throw new Error(`${config.provider} error: ${await res.text()}`);
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        return data.choices?.[0]?.message?.content?.trim() || text;
      }

      if (config.provider === 'GOOGLE') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.modelId || 'gemini-1.5-flash'}:generateContent?key=${config.apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        });
        if (!res.ok) throw new Error(`GOOGLE error: ${await res.text()}`);
        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || text;
      }

      if (config.provider === 'OLLAMA' || config.provider === 'CUSTOM') {
        const url = `${(config.baseUrl || 'http://localhost:11434').replace(/\/$/, '')}/api/chat`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.modelId,
            messages: [{ role: 'user', content: prompt }],
            stream: false,
          }),
        });
        if (!res.ok) throw new Error(`OLLAMA/CUSTOM error: ${await res.text()}`);
        const data = (await res.json()) as { message?: { content?: string } };
        return data.message?.content?.trim() || text;
      }

      // Fallback
      return text;
    } catch (e) {
      this.logger.warn(`Failed to summarize chunk, falling back to original text: ${e}`);
      return text;
    }
  }
}
